namespace HostelManagement.Api.Middleware;

public sealed class HostelScopeMiddleware
{
    private readonly RequestDelegate _next;

    public HostelScopeMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Only scope routes under /api/hostels.
        if (!context.Request.Path.StartsWithSegments(
                "/api/hostels",
                StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        // Controllers may name the route parameter "hostelId" or "id".
        var routeHostelId =
            context.Request.RouteValues["hostelId"]?.ToString()
            ?? context.Request.RouteValues["id"]?.ToString();

        // Routes such as GET /api/hostels have no specific hostel ID.
        if (string.IsNullOrWhiteSpace(routeHostelId))
        {
            await _next(context);
            return;
        }

        var tokenHostelId = context.User.FindFirst("hostel_id")?.Value;

        if (!long.TryParse(routeHostelId, out var requestedId) ||
            !long.TryParse(tokenHostelId, out var allowedId) ||
            requestedId != allowedId)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                message = "You do not have access to this hostel."
            });
            return;
        }

        await _next(context);
    }
}