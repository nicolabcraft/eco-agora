namespace EcoAgora.Api
{
    using System.Linq;
    using Eco.Simulation.Time;
    using EcoAgora.Storage;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using static EcoAgora.Api.AgoraJson;

    /// <summary>
    /// Courbe des joueurs connectes, au meme format que les series de /datasets
    /// (Times en secondes du monde, Values) pour se tracer avec elles.
    /// </summary>
    [ApiController]
    [Route("api/agora/connectes")]
    public class ConnectesController : ControllerBase
    {
        [HttpGet]
        [AllowAnonymous]
        public IActionResult Get([FromQuery] double? debut, [FromQuery] double? fin)
        {
            var finJours = fin ?? WorldTime.Seconds / 86400d;
            var points = AgoraConnectes.Entre(debut ?? 0, finJours);
            return this.Json(new
            {
                Times = points.Select(p => p.Monde).ToArray(),
                Values = points.Select(p => (double)p.EnLigne).ToArray(),
                Unit = "Citizens",
            });
        }
    }
}
