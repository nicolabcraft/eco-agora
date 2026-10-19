namespace EcoAgora.Storage
{
    using System;
    using System.Collections.Generic;
    using System.IO;
    using System.Linq;
    using EcoAgora.Models;
    using LiteDB;

    /// <summary>
    /// Acces a la base du mod. LiteDB est deja embarque dans le serveur (aucun
    /// fournisseur SQLite n'y est present), donc rien a livrer a cote du mod.
    /// </summary>
    public static class AgoraDb
    {
        private static readonly object Gate = new object();
        private static LiteDatabase database;

        /// <summary>Dossier de donnees du mod, a cote de son assembly.</summary>
        public static string DataDirectory => Path.Combine("Mods", "EcoAgora", "data");

        public static string DatabasePath => Path.Combine(DataDirectory, "agora.db");

        public static LiteDatabase Database
        {
            get
            {
                lock (Gate)
                {
                    if (database != null) return database;
                    Directory.CreateDirectory(DataDirectory);
                    // Connection=direct : un seul processus ecrit, c'est le plus rapide.
                    database = new LiteDatabase($"Filename={DatabasePath};Connection=direct");
                    // Dates relues en UTC : sans ce reglage, LiteDB les rend en heure locale
                    // et le JSON les annonce « Z » avec le decalage du serveur en trop
                    // (invisible sur un serveur regle en UTC, faux partout ailleurs).
                    database.UtcDate = true;
                    Migrate(database);
                    return database;
                }
            }
        }

        public static ILiteCollection<Annonce> Annonces => Database.GetCollection<Annonce>("annonces");

        /// <summary>Evenements bruts, conserves le temps de la retention.</summary>
        public static ILiteCollection<AgoraEvent> Events => Database.GetCollection<AgoraEvent>("events");

        /// <summary>Compteurs horaires, gardes a vie : ce sont eux que lisent les courbes.</summary>
        public static ILiteCollection<AgoraRollup> Rollups => Database.GetCollection<AgoraRollup>("rollups");

        private static void Migrate(LiteDatabase db)
        {
            var annonces = db.GetCollection<Annonce>("annonces");
            annonces.EnsureIndex(a => a.ordre);

            // Index choisis pour les filtres du panel : periode, type, joueur, objet.
            var events = db.GetCollection<AgoraEvent>("events");
            events.EnsureIndex(e => e.Ts);
            events.EnsureIndex(e => e.Type);
            events.EnsureIndex(e => e.Player);
            events.EnsureIndex(e => e.Target);

            var rollups = db.GetCollection<AgoraRollup>("rollups");
            rollups.EnsureIndex(r => r.Hour);
            rollups.EnsureIndex(r => r.Type);
        }

        /// <summary>Ferme proprement la base a l'arret du serveur.</summary>
        public static void Close()
        {
            lock (Gate)
            {
                database?.Dispose();
                database = null;
            }
        }

        /// <summary>Les annonces, dans l'ordre voulu par l'administrateur.</summary>
        public static List<Annonce> ListAnnonces() =>
            Annonces.FindAll().OrderBy(a => a.ordre).ToList();

        /// <summary>Remplace l'integralite de la liste, en renumerotant les rangs.</summary>
        public static void ReplaceAnnonces(IEnumerable<Annonce> items)
        {
            var list = items?.Where(a => a != null).ToList() ?? new List<Annonce>();
            var rank = 0;
            foreach (var a in list)
            {
                if (string.IsNullOrWhiteSpace(a.id)) a.id = Guid.NewGuid().ToString("N").Substring(0, 10);
                if (string.IsNullOrWhiteSpace(a.niveau)) a.niveau = "info";
                a.ordre = rank++;
            }

            lock (Gate)
            {
                Annonces.DeleteAll();
                if (list.Count > 0) Annonces.InsertBulk(list);
            }
        }
    }
}
