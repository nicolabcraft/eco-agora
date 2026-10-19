namespace EcoAgora.Api
{
    using System;
    using Eco.Gameplay.Disasters;
    using Eco.Simulation.Time;
    using EcoAgora.Ouverture;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using static EcoAgora.Api.AgoraJson;

    /// <summary>
    /// Compte a rebours de l'asteroide, a la seconde pres.
    ///
    /// /info ne publie que DaysUntilMeteor, un nombre entier de jours : trop
    /// grossier pour un compte a rebours. Le serveur connait pourtant l'instant
    /// exact d'impact (DisasterPlugin.MeteorData.ImpactTime), exprime en secondes
    /// de l'horloge du monde, a comparer a WorldTime.Seconds.
    ///
    /// L'horloge du monde s'arrete quand le serveur est coupe ou en pause : on
    /// renvoie donc un delai restant, et c'est le panel qui le convertit en heure
    /// reelle au moment ou il le recoit.
    /// </summary>
    [ApiController]
    [Route("api/agora/meteor")]
    public class MeteorController : ControllerBase
    {
        [HttpGet]
        [AllowAnonymous]
        public IActionResult Get()
        {
            var data = DisasterPlugin.MeteorData;
            if (data == null)
            {
                return this.Json(new { available = true, hasMeteor = false });
            }

            var maintenant = WorldTime.Seconds;
            var restant = Math.Max(0d, data.ImpactTime - maintenant);

            // Salle d'attente : l'asteroide sera recale a l'ouverture. On annonce donc
            // la duree qui s'appliquera alors, figee, plutot qu'un chiffre qui va sauter.
            var enAttente = AgoraOuverture.EnAttente && AgoraPlugin.Config.RecalerAsteroideAOuverture;
            if (enAttente) restant = AgoraOuverture.DureeAsteroide();

            return this.Json(new
            {
                available = true,
                hasMeteor = !data.MeteorDestroyed && !data.MeteorImpacted,
                destroyed = data.MeteorDestroyed,
                impacted = data.MeteorImpacted,
                paused = WorldTime.Paused || enAttente,
                enAttente,
                secondsUntilImpact = restant,
                // Estimation en heure reelle, valable tant que le monde tourne.
                impactAt = DateTime.UtcNow.AddSeconds(restant).ToString("o"),
                worldSeconds = maintenant,
                impactWorldSeconds = data.ImpactTime,
            });
        }
    }
}
