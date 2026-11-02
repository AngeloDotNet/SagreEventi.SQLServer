namespace SagreEventi.Web.Server.Models.Identity;

/// <summary>Names of the fixed roles.</summary>
public static class Ruoli
{
    /// <summary>Administrator: manages users, reviews and edits events.</summary>
    public const string Admin = "Admin";
    /// <summary>Editor: reviews and edits events.</summary>
    public const string Editor = "Editor";

    /// <summary>All the roles.</summary>
    public static readonly string[] Tutti = [Admin, Editor];
}

/// <summary>Names of the authorization policies.</summary>
public static class Policies
{
    /// <summary>Editing existing events (Admin and Editor roles).</summary>
    public const string PuoModificare = "PuoModificare";

    /// <summary>User and role management (Admin only).</summary>
    public const string SoloAdmin = "SoloAdmin";
}
