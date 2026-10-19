namespace EcoAgora.Api
{
    using Microsoft.AspNetCore.Mvc;
    using Newtonsoft.Json;

    /// <summary>
    /// Le serveur configure MVC avec un Newtonsoft qui enveloppe les listes
    /// (`$type` / `$values`) et deplie les DateTime en objets complets. Pour offrir
    /// un contrat JSON propre et stable, ce mod serialise lui-meme ses reponses.
    /// </summary>
    public static class AgoraJson
    {
        private static readonly JsonSerializerSettings Settings = new JsonSerializerSettings
        {
            TypeNameHandling = TypeNameHandling.None,
            NullValueHandling = NullValueHandling.Include,
            DateFormatHandling = DateFormatHandling.IsoDateFormat,
            DateTimeZoneHandling = DateTimeZoneHandling.Utc,
            Formatting = Formatting.None,
        };

        public static string Serialize(object value) => JsonConvert.SerializeObject(value, Settings);

        /// <summary>Reponse 200 dont le corps echappe au serialiseur du serveur.</summary>
        public static ContentResult Json(this ControllerBase controller, object value) =>
            new ContentResult
            {
                Content = Serialize(value),
                ContentType = "application/json; charset=utf-8",
                StatusCode = 200,
            };

        /// <summary>Reponse d'erreur au meme format.</summary>
        public static ContentResult JsonError(this ControllerBase controller, int status, string message) =>
            new ContentResult
            {
                Content = Serialize(new { message }),
                ContentType = "application/json; charset=utf-8",
                StatusCode = status,
            };
    }
}
