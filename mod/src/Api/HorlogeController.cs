namespace EcoAgora.Api
{
    using System;
    using System.Linq;
    using Eco.Simulation.Time;
    using EcoAgora.Storage;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using static EcoAgora.Api.AgoraJson;

    /// <summary>
    /// Correspondance horloge du monde / heure reelle, pour que le panel affiche les
    /// statistiques a l'heure reelle et non a l'heure du monde.
    /// </summary>
    [ApiController]
    [Route("api/agora/horloge")]
    public class HorlogeController : ControllerBase
    {
        [HttpGet]
        [AllowAnonymous]
        public IActionResult Get()
        {
            var ancrages = AgoraHorloge.Utiles()
                .Select(a => new { utc = DateTime.SpecifyKind(a.Utc, DateTimeKind.Utc).ToString("o"), monde = a.Monde })
                .ToList();

            return this.Json(new
            {
                // Le repere « maintenant » vaut pour toute la session en cours.
                maintenant = new { utc = DateTime.UtcNow.ToString("o"), monde = WorldTime.Seconds },
                enPause = WorldTime.Paused,
                ancrages,
            });
        }
    }
}
