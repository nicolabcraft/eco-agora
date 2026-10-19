namespace EcoAgora.Api
{
    using System;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using static EcoAgora.Api.AgoraJson;

    /// <summary>
    /// Sonde du lot A : une route publique et une route reservee aux administrateurs,
    /// pour verifier que le mod est charge et que la politique d'Eco s'applique.
    /// </summary>
    [ApiController]
    [Route("api/agora")]
    public class PingController : ControllerBase
    {
        [HttpGet("ping")]
        [AllowAnonymous]
        public IActionResult Ping() => this.Json(new
        {
            ok = true,
            mod = "EcoAgora",
            version = AgoraPlugin.Version,
            // Chaine ISO explicite : le serialiseur du serveur deplie les DateTime.
            serverTime = DateTime.UtcNow.ToString("o"),
        });

        [HttpGet("whoami")]
        [Authorize(Policy = "RequireAdmin")]
        public IActionResult WhoAmI()
        {
            var claims = new System.Collections.Generic.List<object>();
            if (this.User != null)
            {
                foreach (var c in this.User.Claims) claims.Add(new { type = c.Type, value = c.Value });
            }

            return this.Json(new
            {
                name = this.User?.Identity?.Name,
                isAuthenticated = this.User?.Identity?.IsAuthenticated ?? false,
                claims,
            });
        }
    }
}
