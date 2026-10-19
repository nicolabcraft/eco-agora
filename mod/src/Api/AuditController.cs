namespace EcoAgora.Api
{
    using System;
    using System.Collections.Generic;
    using System.IO;
    using System.Linq;
    using EcoAgora.Audit;
    using EcoAgora.Storage;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using static EcoAgora.Api.AgoraJson;

    /// <summary>
    /// Journal d'activite. Reserve aux administrateurs : c'est Eco qui verifie, via
    /// la politique RequireAdmin, et non ce mod.
    /// </summary>
    [ApiController]
    [Route("api/agora/audit")]
    [Authorize(Policy = "RequireAdmin")]
    public class AuditController : ControllerBase
    {
        private const int MaxLimit = 500;

        /// <summary>Recherche filtree et paginee dans les evenements bruts.</summary>
        [HttpGet]
        public IActionResult Search(
            string type = null,
            string player = null,
            string target = null,
            string tool = null,
            DateTime? from = null,
            DateTime? to = null,
            int? xmin = null,
            int? xmax = null,
            int? zmin = null,
            int? zmax = null,
            int limit = 50,
            int offset = 0)
        {
            limit = Math.Max(1, Math.Min(MaxLimit, limit));
            offset = Math.Max(0, offset);

            // On vide d'abord le tampon : sinon les dernieres minutes manquent.
            AgoraActionListener.FlushBuffer();
            AgoraWriter.Flush();

            var query = AgoraDb.Events.Query();
            if (!string.IsNullOrWhiteSpace(type)) query = query.Where(e => e.Type == type);
            if (!string.IsNullOrWhiteSpace(player)) query = query.Where(e => e.Player == player);
            if (!string.IsNullOrWhiteSpace(target)) query = query.Where(e => e.Target == target);
            if (!string.IsNullOrWhiteSpace(tool)) query = query.Where(e => e.Tool == tool);
            if (from.HasValue) query = query.Where(e => e.Ts >= from.Value);
            if (to.HasValue) query = query.Where(e => e.Ts <= to.Value);
            if (xmin.HasValue) query = query.Where(e => e.X >= xmin.Value);
            if (xmax.HasValue) query = query.Where(e => e.X <= xmax.Value);
            if (zmin.HasValue) query = query.Where(e => e.Z >= zmin.Value);
            if (zmax.HasValue) query = query.Where(e => e.Z <= zmax.Value);

            var total = query.Count();
            var page = query.OrderByDescending(e => e.Ts).Skip(offset).Limit(limit).ToList();

            return this.Json(new Dictionary<string, object>
            {
                ["total"] = total,
                ["limit"] = limit,
                ["offset"] = offset,
                ["events"] = page.Select(Shape).ToList(),
            });
        }

        /// <summary>Etat du journal : debit, file, taille, repartition par type.</summary>
        [HttpGet("stats")]
        public IActionResult Stats()
        {
            long size = 0;
            try { size = new FileInfo(AgoraDb.DatabasePath).Length; } catch { /* base absente */ }

            var since = DateTime.UtcNow.AddHours(-24);
            var topTypes = AgoraDb.Rollups.Find(r => r.Hour >= since)
                .GroupBy(r => r.Type)
                .Select(g => new { type = g.Key, count = g.Sum(r => r.Count) })
                .OrderByDescending(x => x.count)
                .Take(15)
                .ToList();

            return this.Json(new Dictionary<string, object>
            {
                ["enabled"] = AgoraPlugin.Config.AuditEnabled,
                ["retentionDays"] = AgoraPlugin.Config.RetentionDays,
                ["aggregationWindowSeconds"] = AgoraPlugin.Config.AggregationWindowSeconds,
                ["events"] = AgoraDb.Events.Count(),
                ["rollups"] = AgoraDb.Rollups.Count(),
                ["databaseBytes"] = size,
                ["written"] = AgoraWriter.Written,
                ["queued"] = AgoraWriter.Queued,
                ["dropped"] = AgoraWriter.Dropped,
                ["errors"] = AgoraWriter.Errors,
                ["archived"] = AgoraWriter.Archived,
                ["topTypes24h"] = topTypes,
            });
        }

        /// <summary>Compteurs horaires : ce que tracent les courbes du panel.</summary>
        [HttpGet("rollups")]
        public IActionResult Rollups(DateTime? from = null, DateTime? to = null, string type = null)
        {
            var start = from ?? DateTime.UtcNow.AddDays(-7);
            var end = to ?? DateTime.UtcNow;
            var query = AgoraDb.Rollups.Query().Where(r => r.Hour >= start && r.Hour <= end);
            if (!string.IsNullOrWhiteSpace(type)) query = query.Where(r => r.Type == type);

            var series = query.ToList()
                .GroupBy(r => new { r.Hour, r.Type })
                .Select(g => new
                {
                    hour = g.Key.Hour.ToString("o"),
                    type = g.Key.Type,
                    count = g.Sum(r => r.Count),
                    quantity = g.Sum(r => r.Quantity),
                })
                .OrderBy(x => x.hour)
                .ToList();

            return this.Json(new Dictionary<string, object> { ["series"] = series });
        }

        /// <summary>Valeurs distinctes d'un champ, pour alimenter les filtres du panel.</summary>
        [HttpGet("distinct")]
        public IActionResult Distinct(string field = "type")
        {
            var since = DateTime.UtcNow.AddDays(-30);
            var events = AgoraDb.Events.Find(e => e.Ts >= since);
            IEnumerable<string> values;
            switch ((field ?? string.Empty).ToLowerInvariant())
            {
                case "player": values = events.Select(e => e.Player); break;
                case "target": values = events.Select(e => e.Target); break;
                case "tool": values = events.Select(e => e.Tool); break;
                case "type": values = events.Select(e => e.Type); break;
                default: return this.JsonError(400, "Champ non supporte : type, player, target ou tool.");
            }

            var distinct = values.Where(v => !string.IsNullOrWhiteSpace(v))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(v => v, StringComparer.OrdinalIgnoreCase)
                .Take(400)
                .ToList();

            return this.Json(new Dictionary<string, object> { ["field"] = field, ["values"] = distinct });
        }

        private static Dictionary<string, object> Shape(AgoraEvent e) => new Dictionary<string, object>
        {
            ["id"] = e.Id?.ToString(),
            ["ts"] = e.Ts.ToString("o"),
            ["tsEnd"] = e.TsEnd.ToString("o"),
            ["type"] = e.Type,
            ["player"] = e.Player,
            ["target"] = e.Target,
            ["tool"] = e.Tool,
            ["worldObject"] = e.WorldObject,
            ["quantity"] = e.Quantity,
            ["count"] = e.Count,
            ["x"] = e.X,
            ["y"] = e.Y,
            ["z"] = e.Z,
            ["details"] = e.Details,
        };
    }
}
