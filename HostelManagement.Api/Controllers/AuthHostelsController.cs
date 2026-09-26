using System.ComponentModel.DataAnnotations;
using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HostelManagement.Api.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/auth/hostels")]
public class AuthHostelsController : ControllerBase
{
    private readonly HostelDbContext _db;
    private readonly IPasswordHasher<AppUser> _passwordHasher;

    public AuthHostelsController(
        HostelDbContext db,
        IPasswordHasher<AppUser> passwordHasher)
    {
        _db = db;
        _passwordHasher = passwordHasher;
    }

    [HttpPost]
    public async Task<IActionResult> GetAvailableHostels(
        AvailableHostelsRequest request,
        CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user = await _db.AppUsers.FirstOrDefaultAsync(
            u => u.Email == email && u.IsActive,
            cancellationToken);

        if (user is null ||
            _passwordHasher.VerifyHashedPassword(
                user,
                user.PasswordHash,
                request.Password) == PasswordVerificationResult.Failed)
        {
            return Unauthorized(new
            {
                message = "Invalid email or password."
            });
        }

        var staffHostels = await (
            from link in _db.UserHostelRoles
            join role in _db.Roles on link.RoleId equals role.Id
            join hostel in _db.Hostels on link.HostelId equals hostel.Id
            where link.UserId == user.Id && hostel.IsActive
            select new HostelLoginOption(
                hostel.Id,
                hostel.Name,
                role.Name))
            .ToListAsync(cancellationToken);

        var tenantHostels = await (
            from tenant in _db.Tenants.AsNoTracking()
            join hostel in _db.Hostels.AsNoTracking()
                on tenant.HostelId equals hostel.Id
            where tenant.UserId == user.Id
                  && tenant.IsActive
                  && hostel.IsActive
            select new HostelLoginOption(
                hostel.Id,
                hostel.Name,
                "Tenant"))
            .ToListAsync(cancellationToken);

        var hostels = staffHostels
            .Concat(tenantHostels)
            .GroupBy(item => item.HostelId)
            .Select(group => group.First())
            .OrderBy(item => item.HostelName)
            .ToList();

        if (hostels.Count == 0)
        {
            return Unauthorized(new
            {
                message = "This account has no active hostel access."
            });
        }

        return Ok(new { hostels });
    }
}

public sealed class AvailableHostelsRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = "";

    [Required]
    public string Password { get; set; } = "";
}

public sealed record HostelLoginOption(
    long HostelId,
    string HostelName,
    string Role);