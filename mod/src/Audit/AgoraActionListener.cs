namespace EcoAgora.Audit
{
    using System;
    using System.Collections.Concurrent;
    using System.Collections.Generic;
    using System.Linq;
    using System.Reflection;
    using Eco.Core.Utils;
    using Eco.Gameplay.Aliases;
    using Eco.Gameplay.GameActions;
    using Eco.Gameplay.Property;
    using Eco.Shared.Utils;
    using EcoAgora.Storage;

    /// <summary>
    /// Ecoute les actions de jeu et alimente le journal.
    ///
    /// Les sous-classes de GameAction n'ont pas de proprietes communes : on les lit
    /// donc par reflexion, en essayant une liste de noms usuels, avec un cache par
    /// type pour ne payer la reflexion qu'une fois.
    ///
    /// ActionPerformed est appele depuis la boucle de jeu : il ne fait qu'empiler.
    /// </summary>
    public class AgoraActionListener : IGameActionAware
    {
        /// <summary>Actions repetitives regroupees par defaut (miner, batir, ramasser...).</summary>
        private static readonly HashSet<string> DefaultAggregated = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "DigOrMine", "ConstructOrDeconstruct", "PlaceOrPickUpObject", "DropOrPickupBlock",
            "TampRoad", "PlowField", "HarvestOrHunt", "ChopTree", "ChopStump",
            "CleanupTreeDebris", "CreateTreeDebris", "BlockPaint", "BlockPaintCleanup",
            "PlantSeeds", "FertilizeAction", "MoveWorldObject",
        };

        private static readonly string[] PlayerProps =
            { "Citizen", "User", "Actor", "Player", "PlayerUser", "ChopperUser" };

        private static readonly string[] PositionProps =
            { "ActionLocation", "Position", "Location", "WorldPos", "WorldPosition", "BlockPosition", "Pos", "TargetPosition" };

        private static readonly string[] ToolProps = { "ToolUsed", "Tool", "ToolType" };

        private static readonly string[] TargetProps =
            { "ItemType", "ItemUsed", "Item", "ItemName", "ItemDisplayName", "Species", "BlockForm", "CraftedItem", "TargetInventory" };

        private static readonly string[] QuantityProps =
            { "ItemsMoved", "OrderCount", "NumberOfItems", "Quantity", "Count", "Amount", "NumItems", "ChangeInItemCount", "Labor" };

        private static readonly string[] ObjectProps = { "WorldObjectItem", "WorldObject" };

        /// <summary>Cache de resolution : type d'action -> accesseurs retenus.</summary>
        private static readonly ConcurrentDictionary<Type, Shape> Shapes = new ConcurrentDictionary<Type, Shape>();

        /// <summary>Tampon d'agregation, vide par la fenetre configuree.</summary>
        private static readonly ConcurrentDictionary<string, AgoraEvent> Buffer = new ConcurrentDictionary<string, AgoraEvent>();

        private static DateTime lastBufferFlush = DateTime.UtcNow;

        private sealed class Shape
        {
            public PropertyInfo Player;
            public PropertyInfo Position;
            public PropertyInfo Tool;
            public PropertyInfo Target;
            public PropertyInfo Quantity;
            public PropertyInfo Obj;
        }

        private static PropertyInfo Pick(Type type, string[] names)
        {
            foreach (var name in names)
            {
                var p = type.GetProperty(name, BindingFlags.Public | BindingFlags.Instance);
                if (p != null && p.CanRead) return p;
            }

            return null;
        }

        private static Shape ShapeOf(Type type) => Shapes.GetOrAdd(type, t => new Shape
        {
            Player = Pick(t, PlayerProps),
            Position = Pick(t, PositionProps),
            Tool = Pick(t, ToolProps),
            Target = Pick(t, TargetProps),
            Quantity = Pick(t, QuantityProps),
            Obj = Pick(t, ObjectProps),
        });

        private static string Text(object value)
        {
            if (value == null) return null;
            if (value is Type t) return t.Name;
            var s = value.ToString();
            if (string.IsNullOrWhiteSpace(s)) return null;
            return s.Length > 120 ? s.Substring(0, 120) : s;
        }

        private static double Number(object value)
        {
            if (value == null) return 0;
            try { return Convert.ToDouble(value); } catch { return 0; }
        }


        /// <summary>Ce mod observe seulement : il n'autorise ni ne bloque rien.</summary>
        public LazyResult CanPerformAction(GameAction action) => new LazyResult(Result.Succeeded);

        /// <summary>Aucun contournement d'autorisation : ce mod n'est pas concerne.</summary>
        public LazyResult ShouldOverrideAuth(IAlias alias, IOwned owned, GameAction action) =>
            new LazyResult(Result.FailedNoMessage);

        /// <summary>
        /// Appele depuis la boucle de jeu : on extrait le strict necessaire, puis on
        /// empile ou on agrege. Aucune ecriture disque ici.
        /// </summary>
        public void ActionPerformed(GameAction action)
        {
            if (action == null) return;
            var config = AgoraPlugin.Config;
            if (!config.AuditEnabled) return;

            try
            {
                var type = action.GetType();
                var shape = ShapeOf(type);
                var name = type.Name;

                var playerObj = shape.Player?.GetValue(action);
                var player = Text(playerObj?.GetType().GetProperty("Name")?.GetValue(playerObj)) ?? Text(playerObj);

                ReadPosition(shape.Position?.GetValue(action), out var x, out var y, out var z);

                var evt = new AgoraEvent
                {
                    Ts = DateTime.UtcNow,
                    TsEnd = DateTime.UtcNow,
                    Type = "action." + name,
                    Player = player,
                    Target = Text(shape.Target?.GetValue(action)),
                    Tool = Text(shape.Tool?.GetValue(action)),
                    WorldObject = Text(shape.Obj?.GetValue(action)),
                    Quantity = Math.Abs(Number(shape.Quantity?.GetValue(action))),
                    X = x,
                    Y = y,
                    Z = z,
                    Count = 1,
                };

                if (ShouldAggregate(name, player, config)) Aggregate(evt, config);
                else AgoraWriter.Enqueue(evt);
            }
            catch
            {
                // Une action mal formee ne doit jamais interrompre le jeu.
            }
        }

        private static bool ShouldAggregate(string actionName, string player, AgoraConfig config)
        {
            if (!string.IsNullOrWhiteSpace(config.DetailedPlayers) && player != null)
            {
                foreach (var p in config.DetailedPlayers.Split(','))
                    if (string.Equals(p.Trim(), player, StringComparison.OrdinalIgnoreCase)) return false;
            }

            if (string.IsNullOrWhiteSpace(config.AggregatedActions)) return DefaultAggregated.Contains(actionName);
            return config.AggregatedActions.Split(',').Any(a => string.Equals(a.Trim(), actionName, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>Regroupe par joueur, type, cible, outil, fenetre de temps et zone.</summary>
        private static void Aggregate(AgoraEvent evt, AgoraConfig config)
        {
            var zone = Math.Max(1, config.AggregationZoneSize);
            var window = Math.Max(5, config.AggregationWindowSeconds);
            var bucket = evt.Ts.Ticks / (TimeSpan.TicksPerSecond * window);
            var key = string.Join("|", evt.Type, evt.Player, evt.Target, evt.Tool, bucket,
                evt.X / zone, evt.Z / zone);

            Buffer.AddOrUpdate(
                key,
                _ => evt,
                (_, existing) =>
                {
                    existing.Count += 1;
                    existing.Quantity += evt.Quantity;
                    existing.TsEnd = evt.Ts;
                    return existing;
                });

            if (DateTime.UtcNow - lastBufferFlush >= TimeSpan.FromSeconds(window))
                FlushBuffer(bucket);
        }

        /// <summary>Envoie a l'ecrivain toutes les fenetres closes.</summary>
        public static void FlushBuffer(long currentBucket = long.MaxValue)
        {
            lastBufferFlush = DateTime.UtcNow;
            foreach (var key in Buffer.Keys.ToList())
            {
                var parts = key.Split('|');
                if (parts.Length < 5) continue;
                if (long.TryParse(parts[4], out var bucket) && bucket >= currentBucket) continue;
                if (Buffer.TryRemove(key, out var done)) AgoraWriter.Enqueue(done);
            }
        }

        /// <summary>Lit X, Y, Z sur un vecteur quel qu'en soit le type concret.</summary>
        private static void ReadPosition(object pos, out int x, out int y, out int z)
        {
            x = y = z = 0;
            if (pos == null) return;
            var t = pos.GetType();
            x = (int)Number(t.GetProperty("X")?.GetValue(pos) ?? t.GetField("x")?.GetValue(pos));
            y = (int)Number(t.GetProperty("Y")?.GetValue(pos) ?? t.GetField("y")?.GetValue(pos));
            z = (int)Number(t.GetProperty("Z")?.GetValue(pos) ?? t.GetField("z")?.GetValue(pos));
        }
    }
}
