using System.ComponentModel.DataAnnotations;
using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HostelManagement.Api.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/hostels/{hostelId:long}/tenants/{tenantId:long}/account")]
public class TenantAccountsController : ControllerBase
{
    private readonly HostelDbContext _db;
    private readonly IPasswordHasher<AppUser> _passwordHasher;
    private readonly ILogger<TenantAccountsController> _logger;

    public TenantAccountsController(
        HostelDbContext db,
        IPasswordHasher<AppUser> passwordHasher,
        ILogger<TenantAccountsController> logger)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        long hostelId,
        long tenantId,
        CreateTenantAccountRequest request,
        CancellationToken cancellationToken)
    {
        var tenant = await _db.Tenants.FirstOrDefaultAsync(
            t => t.Id == tenantId &&
                 t.HostelId == hostelId &&
                 t.IsActive,
            cancellationToken);

        if (tenant is null)
        {
            return NotFound(new { message = "Active tenant not found." });
        }

        if (tenant.UserId.HasValue)
        {
            return Conflict(new
            {
                message = "This tenant already has a login account."
            });
        }

        var email = request.Email.Trim().ToLowerInvariant();

        var emailExists = await _db.AppUsers.AnyAsync(
            u => u.Email.ToLower() == email,
            cancellationToken);

        if (emailExists)
        {
            return Conflict(new
            {
                message = "An account with this email already exists."
            });
        }

        var now = DateTimeOffset.UtcNow;

        var user = new AppUser
        {
            Email = email,
            FullName = tenant.FullName,
            Phone = tenant.PhoneNumber,
            PasswordHash = "",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        await using var transaction =
            await _db.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            _db.AppUsers.Add(user);
            await _db.SaveChangesAsync(cancellationToken);

            tenant.UserId = user.Id;
            tenant.Email = email;
            tenant.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);

            return Conflict(new
            {
                message = "Could not create the tenant account. The email may already be in use."
            });
        }

        _logger.LogInformation(
            "Created user account {UserId} for tenant {TenantId} in hostel {HostelId}",
            user.Id,
            tenant.Id,
            hostelId);

        return Created(
            $"/api/hostels/{hostelId}/tenants/{tenantId}/account",
            new
            {
                userId = user.Id,
                tenantId = tenant.Id,
                hostelId,
                user.Email,
                user.FullName
            });
    }
}

public sealed class CreateTenantAccountRequest
{
    [Required]
    [EmailAddress]
    [StringLength(254)]
    public string Email { get; set; } = "";

    [Required]
    [MinLength(12)]
    public string Password { get; set; } = "";
}