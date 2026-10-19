namespace EcoAgora.Storage
{
    using System;
    using System.Collections.Concurrent;
    using System.Collections.Generic;
    using System.IO;
    using System.IO.Compression;
    using System.Linq;
    using System.Threading;
    using LiteDB;
    using Newtonsoft.Json;

    /// <summary>
    /// Ecriture du journal. Les evenements arrivent depuis la boucle de jeu, qui ne
    /// doit jamais attendre : on se contente d'empiler, et un thread unique vide la
    /// file par lots. C'est le meme principe que le mod EnqueteEcoAudit.
    /// </summary>
    public static class AgoraWriter
    {
        private static readonly ConcurrentQueue<AgoraEvent> Queue = new ConcurrentQueue<AgoraEvent>();
        private static Thread thread;
        private static volatile bool running;

        public static long Written { get; private set; }

        public static long Dropped { get; private set; }

        public static long Errors { get; private set; }

        public static long Archived { get; private set; }

        public static int Queued => Queue.Count;

        /// <summary>Au-dela, on prefere perdre des evenements que la memoire du serveur.</summary>
        private const int MaxQueue = 200000;

        public static void Enqueue(AgoraEvent e)
        {
            if (e == null) return;
            if (Queue.Count >= MaxQueue) { Dropped++; return; }
            Queue.Enqueue(e);
        }

        public static void Start()
        {
            if (running) return;
            running = true;
            thread = new Thread(Loop) { IsBackground = true, Name = "EcoAgora-Writer" };
            thread.Start();
        }

        public static void Stop()
        {
            running = false;
            try { thread?.Join(TimeSpan.FromSeconds(5)); } catch { /* arret force */ }
            Flush();
        }

        private static void Loop()
        {
            var lastMaintenance = DateTime.UtcNow;
            while (running)
            {
                try
                {
                    Flush();
                    if (DateTime.UtcNow - lastMaintenance > TimeSpan.FromHours(1))
                    {
                        lastMaintenance = DateTime.UtcNow;
                        Maintain();
                        // Un releve economique par heure : la serie du panel s'appuie dessus.
                        EcoAgora.Economy.AgoraEconomySampler.Sample();
                    }
                }
                catch (Exception ex)
                {
                    Errors++;
                    Console.WriteLine("[EcoAgora] ecriture du journal en echec : " + ex.Message);
                }

                Thread.Sleep(2000);
            }
        }

        /// <summary>Vide la file par lots, et met a jour les compteurs horaires.</summary>
        public static void Flush()
        {
            var batch = new List<AgoraEvent>();
            while (batch.Count < 2000 && Queue.TryDequeue(out var e)) batch.Add(e);
            if (batch.Count == 0) return;

            AgoraDb.Events.InsertBulk(batch);
            Written += batch.Count;
            UpdateRollups(batch);
        }

        private static void UpdateRollups(IEnumerable<AgoraEvent> batch)
        {
            var rollups = AgoraDb.Rollups;
            foreach (var group in batch.GroupBy(e => new
            {
                Hour = new DateTime(e.Ts.Year, e.Ts.Month, e.Ts.Day, e.Ts.Hour, 0, 0, DateTimeKind.Utc),
                e.Type,
                e.Player,
            }))
            {
                var id = $"{group.Key.Hour:yyyyMMddHH}|{group.Key.Type}|{group.Key.Player}";
                var existing = rollups.FindById(id);
                if (existing == null)
                {
                    rollups.Insert(new AgoraRollup
                    {
                        Id = id,
                        Hour = group.Key.Hour,
                        Type = group.Key.Type,
                        Player = group.Key.Player,
                        Count = group.Sum(e => e.Count),
                        Quantity = group.Sum(e => e.Quantity),
                    });
                }
                else
                {
                    existing.Count += group.Sum(e => e.Count);
                    existing.Quantity += group.Sum(e => e.Quantity);
                    rollups.Update(existing);
                }
            }
        }

        /// <summary>Archive puis purge les evenements trop anciens. Les compteurs restent.</summary>
        public static void Maintain()
        {
            var config = AgoraPlugin.Config;
            var days = Math.Max(1, config?.RetentionDays ?? 65);
            var cutoff = DateTime.UtcNow.AddDays(-days);

            var old = AgoraDb.Events.Find(Query.LT("Ts", cutoff)).Take(50000).ToList();
            if (old.Count == 0) return;

            if (config == null || config.ArchiveBeforePurge) Archive(old);
            foreach (var e in old) AgoraDb.Events.Delete(e.Id);
            Console.WriteLine($"[EcoAgora] {old.Count} evenement(s) archives et purges (> {days} jours)");
        }

        private static void Archive(List<AgoraEvent> events)
        {
            var dir = Path.Combine(AgoraDb.DataDirectory, "archives");
            Directory.CreateDirectory(dir);
            foreach (var byDay in events.GroupBy(e => e.Ts.Date))
            {
                var path = Path.Combine(dir, $"journal_{byDay.Key:yyyy-MM-dd}.jsonl.gz");
                using (var file = new FileStream(path, FileMode.Append, FileAccess.Write))
                using (var gzip = new GZipStream(file, CompressionLevel.Optimal))
                using (var writer = new StreamWriter(gzip))
                {
                    foreach (var e in byDay) writer.WriteLine(JsonConvert.SerializeObject(e));
                }

                Archived += byDay.Count();
            }
        }
    }
}
