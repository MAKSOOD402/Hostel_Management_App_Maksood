using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace HostelManagement.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly HostelDbContext _db;
    private readonly IPasswordHasher<AppUser> _passwordHasher;
    private readonly IConfiguration _configuration;

    public AuthController(
        HostelDbContext db,
        IPasswordHasher<AppUser> passwordHasher,
        IConfiguration configuration)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _configuration = configuration;
    }

    [AllowAnonymous]
    [HttpPost("bootstrap-admin")]
    public async Task<IActionResult> BootstrapAdmin(
        BootstrapAdminRequest request,
        CancellationToken cancellationToken)
    {
        await using var transaction =
            await _db.Database.BeginTransactionAsync(
                System.Data.IsolationLevel.Serializable,
                cancellationToken);

        if (await _db.AppUsers.AnyAsync(cancellationToken))
        {
            return Conflict(new
            {
                message = "An account already exists. Initial Admin setup is closed."
            });
        }

        var hostelExists = await _db.Hostels.AnyAsync(
            h => h.Id == request.HostelId && h.IsActive,
            cancellationToken);

        if (!hostelExists)
            return NotFound(new { message = "Active hostel not found." });

        var adminRole = await _db.Roles
            .FirstOrDefaultAsync(r => r.Name == "Admin", cancellationToken);

        if (adminRole is null)
        {
            return StatusCode(500, new
            {
                message = "Admin role is missing. Run the database schema script."
            });
        }

        var email = request.Email.Trim().ToLowerInvariant();

        var user = new AppUser
        {
            Email = email,
            FullName = request.FullName.Trim(),
            Phone = request.Phone?.Trim(),
            PasswordHash = ""
        };

        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        _db.AppUsers.Add(user);
        await _db.SaveChangesAsync(cancellationToken);

        _db.UserHostelRoles.Add(new UserHostelRole
        {
            UserId = user.Id,
            HostelId = request.HostelId,
            RoleId = adminRole.Id
        });

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(CreateToken(user, request.HostelId, adminRole.Name));
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(
        LoginRequest request,
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
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var staffMembership = await (
            from link in _db.UserHostelRoles
            join role in _db.Roles on link.RoleId equals role.Id
            join hostel in _db.Hostels on link.HostelId equals hostel.Id
            where link.UserId == user.Id
                  && link.HostelId == request.HostelId
                  && hostel.IsActive
            select role.Name)
            .FirstOrDefaultAsync(cancellationToken);

        if (staffMembership is not null)
        {
            user.LastLoginAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(CreateToken(user, request.HostelId, staffMembership));
        }

        var tenantId = await _db.Tenants
            .AsNoTracking()
            .Where(t =>
                t.UserId == user.Id &&
                t.HostelId == request.HostelId &&
                t.IsActive)
            .Select(t => (long?)t.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (tenantId is null)
        {
            return Unauthorized(new
            {
                message = "No access to that hostel."
            });
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(CreateToken(user, request.HostelId, "Tenant", tenantId));
    }

    private object CreateToken(
        AppUser user,
        long hostelId,
        string role,
        long? tenantId = null)
    {
        var issuer = _configuration["Jwt:Issuer"]!;
        var audience = _configuration["Jwt:Audience"]!;
        var key = _configuration["Jwt:SigningKey"]!;

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, role),
            new("hostel_id", hostelId.ToString())
        };

        if (tenantId.HasValue)
        {
            claims.Add(new Claim("tenant_id", tenantId.Value.ToString()));
        }

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: credentials);

        return new
        {
            accessToken = new JwtSecurityTokenHandler().WriteToken(token),
            expiresAtUtc = token.ValidTo,
            user = new
            {
                user.Id,
                user.Email,
                user.FullName,
                hostelId,
                role,
                tenantId
            }
        };
    }
}

public sealed class BootstrapAdminRequest
{
    public long HostelId { get; set; }

    [Required]
    [EmailAddress]
    public string Email { get; set; } = "";

    [Required]
    [MinLength(12)]
    public string Password { get; set; } = "";

    [Required]
    [StringLength(150, MinimumLength = 2)]
    public string FullName { get; set; } = "";

    public string? Phone { get; set; }
}

public sealed class LoginRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = "";

    [Required]
    public string Password { get; set; } = "";

    public long HostelId { get; set; }
}