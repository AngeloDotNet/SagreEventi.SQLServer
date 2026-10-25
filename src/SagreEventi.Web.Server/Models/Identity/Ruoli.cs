namespace SagreEventi.Web.Server.Models.Identity;

public static class Ruoli
{
    public const string Admin = "Admin";
    public const string Editor = "Editor";

    public static readonly string[] Tutti = [Admin, Editor];
}

public static class Policies
{
    /// <summary>Editing existing events (Admin and Editor roles).</summary>
    public const string PuoModificare = "PuoModificare";

    /// <summary>User and role management (Admin only).</summary>
    public const string SoloAdmin = "SoloAdmin";
}
