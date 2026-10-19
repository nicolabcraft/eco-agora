namespace EcoAgora.Economy
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Eco.Core.Systems;
    using Eco.Gameplay.Economy;
    using EcoAgora.Storage;
    using LiteDB;

    /// <summary>Photographie de l'economie a un instant donne.</summary>
    public class AgoraEconomySnapshot
    {
        [BsonId]
        public string Id { get; set; }

        public DateTime Hour { get; set; }

        public int Currencies { get; set; }

        public int Accounts { get; set; }

        public int PersonalAccounts { get; set; }

        public int GovernmentAccounts { get; set; }

        public double TotalHoldings { get; set; }

        public double GovernmentHoldings { get; set; }

        public double PersonalHoldings { get; set; }

        /// <summary>Detail par devise : nom, avoirs totaux, nombre de comptes concernes.</summary>
        public List<AgoraCurrencyLine> Lines { get; set; } = new List<AgoraCurrencyLine>();
    }

    public class AgoraCurrencyLine
    {
        public string Name { get; set; }

        public double Total { get; set; }

        public double Government { get; set; }

        public int Holders { get; set; }

        /// <summary>
        /// Detenteurs dont le solde n'est pas un nombre fini. Les monnaies personnelles
        /// d'Eco ne sont pas gagees : leur emetteur peut en creer sans limite, et le jeu
        /// remonte alors une valeur infinie. On les compte sans les sommer.
        /// </summary>
        public int UnlimitedHolders { get; set; }

        /// <summary>Vrai si aucun solde fini n'a ete releve : monnaie personnelle.</summary>
        public bool Unlimited => this.Holders == 0 && this.UnlimitedHolders > 0;
    }

    /// <summary>
    /// Releve periodique de l'economie : devises, comptes, avoirs. Le resultat est
    /// horodate a l'heure pour constituer une serie exploitable par le panel, sans
    /// jamais avoir a parcourir les comptes a la demande.
    /// </summary>
    public static class AgoraEconomySampler
    {
        public static ILiteCollection<AgoraEconomySnapshot> Collection =>
            AgoraDb.Database.GetCollection<AgoraEconomySnapshot>("economy");

        public static DateTime LastSample { get; private set; }

        public static string LastError { get; private set; }

        /// <summary>Prend un releve et l'enregistre pour l'heure courante.</summary>
        public static AgoraEconomySnapshot Sample()
        {
            var now = DateTime.UtcNow;
            var hour = new DateTime(now.Year, now.Month, now.Day, now.Hour, 0, 0, DateTimeKind.Utc);

            try
            {
                var currencies = Registrars.Get<Currency>().All().ToList();
                var accounts = Registrars.Get<BankAccount>().All().ToList();

                var snapshot = new AgoraEconomySnapshot
                {
                    Id = hour.ToString("yyyyMMddHH"),
                    Hour = hour,
                    Currencies = currencies.Count,
                    Accounts = accounts.Count,
                    PersonalAccounts = accounts.Count(a => a is PersonalBankAccount),
                    GovernmentAccounts = accounts.Count(a => a is GovernmentBankAccount || a is TreasuryBankAccount),
                };

                foreach (var currency in currencies)
                {
                    var line = new AgoraCurrencyLine { Name = currency.Name };
                    foreach (var account in accounts)
                    {
                        var amount = account.GetCurrencyHoldingVal(currency);

                        // Un solde infini ou NaN fausserait tous les totaux : on le compte a part.
                        if (float.IsNaN(amount) || float.IsInfinity(amount))
                        {
                            line.UnlimitedHolders += 1;
                            continue;
                        }

                        if (amount <= 0) continue;
                        line.Total += amount;
                        line.Holders += 1;
                        if (account is GovernmentBankAccount || account is TreasuryBankAccount)
                            line.Government += amount;
                    }

                    snapshot.Lines.Add(line);
                    snapshot.TotalHoldings += line.Total;
                    snapshot.GovernmentHoldings += line.Government;
                }

                snapshot.PersonalHoldings = snapshot.TotalHoldings - snapshot.GovernmentHoldings;
                snapshot.Lines = snapshot.Lines.OrderByDescending(l => l.Total).ToList();

                Collection.Upsert(snapshot);
                LastSample = now;
                LastError = null;
                return snapshot;
            }
            catch (Exception e)
            {
                LastError = e.Message;
                Console.WriteLine("[EcoAgora] releve economique en echec : " + e.Message);
                return null;
            }
        }

        /// <summary>Dernier releve connu, sans en declencher un nouveau.</summary>
        public static AgoraEconomySnapshot Latest() =>
            Collection.Query().OrderByDescending(s => s.Hour).FirstOrDefault();

        public static List<AgoraEconomySnapshot> History(int days)
        {
            var since = DateTime.UtcNow.AddDays(-Math.Max(1, days));
            return Collection.Query().Where(s => s.Hour >= since).OrderBy(s => s.Hour).ToList();
        }
    }
}
