namespace EcoAgora.Models
{
    using LiteDB;

    /// <summary>
    /// Une annonce affichee en haut des pages du panel.
    ///
    /// Les proprietes portent volontairement les memes noms, a la casse pres, que les
    /// cles JSON attendues par le panel : le serveur configure MVC avec Newtonsoft et
    /// une convention PascalCase, et cela evite toute ambiguite de liaison dans les
    /// deux sens (lecture publique et ecriture administrateur).
    /// </summary>
    public class Annonce
    {
        [BsonId]
        public string id { get; set; }

        public string titre { get; set; }

        public string message { get; set; }

        /// <summary>info, important ou alerte.</summary>
        public string niveau { get; set; }

        public bool epinglee { get; set; }

        /// <summary>Bornes ISO 8601 facultatives : hors fenetre, l'annonce n'est pas affichee.</summary>
        public string debut { get; set; }

        public string fin { get; set; }

        public string lienUrl { get; set; }

        public string lienTexte { get; set; }

        /// <summary>Rang d'affichage, tel que l'administrateur l'a ordonne.</summary>
        public int ordre { get; set; }
    }
}
