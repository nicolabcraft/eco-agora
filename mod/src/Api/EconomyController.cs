namespace EcoAgora.Api
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using EcoAgora.Economy;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using static EcoAgora.Api.AgoraJson;

    /// <summary>
    /// Agregats economiques. Lecture publique : ce sont des totaux anonymes, du meme
    /// ordre que ce que /info expose deja.
    /// </summary>
    [ApiController]
    [Route("api/agora/economy")]
    public class EconomyController : ControllerBase
    {
        [HttpGet]
        [AllowAnonymous]
        public IActionResult Latest()
        {
            var snapshot = AgoraEconomySampler.Latest();
            if (snapshot == null)
            {
                return this.Json(new Dictionary<string, object>
                {
                    ["available"] = false,
                    ["message"] = "Aucun releve encore effectue.",
                    ["error"] = AgoraEconomySampler.LastError,
                });
            }

            return this.Json(new Dictionary<string, object>
            {
                ["available"] = true,
                ["hour"] = snapshot.Hour.ToString("o"),
                ["currencies"] = snapshot.Currencies,
                ["accounts"] = snapshot.Accounts,
                ["personalAccounts"] = snapshot.PersonalAccounts,
                ["governmentAccounts"] = snapshot.GovernmentAccounts,
                ["totalHoldings"] = snapshot.TotalHoldings,
                ["governmentHoldings"] = snapshot.GovernmentHoldings,
                ["personalHoldings"] = snapshot.PersonalHoldings,
                ["lines"] = snapshot.Lines.Select(l => new
                {
                    name = l.Name,
                    total = l.Total,
                    government = l.Government,
                    holders = l.Holders,
                    unlimitedHolders = l.UnlimitedHolders,
                    unlimited = l.Unlimited,
                }).ToList(),
            });
        }

        /// <summary>Serie horaire, pour les courbes du panel.</summary>
        [HttpGet("history")]
        [AllowAnonymous]
        public IActionResult History(int days = 14)
        {
            var series = AgoraEconomySampler.History(days).Select(s => new
            {
                hour = s.Hour.ToString("o"),
                totalHoldings = s.TotalHoldings,
                governmentHoldings = s.GovernmentHoldings,
                personalHoldings = s.PersonalHoldings,
                accounts = s.Accounts,
                currencies = s.Currencies,
            }).ToList();

            return this.Json(new Dictionary<string, object> { ["days"] = days, ["series"] = series });
        }

        /// <summary>Force un releve immediat. Reserve aux administrateurs.</summary>
        [HttpPost("sample")]
        [Authorize(Policy = "RequireAdmin")]
        public IActionResult SampleNow()
        {
            var snapshot = AgoraEconomySampler.Sample();
            if (snapshot == null) return this.JsonError(500, AgoraEconomySampler.LastError ?? "Releve impossible.");
            return this.Latest();
        }
    }
}
