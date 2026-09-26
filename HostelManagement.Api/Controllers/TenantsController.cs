using System.ComponentModel.DataAnnotations;
using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Microsoft.AspNetCore.Authorization;
namespace HostelManagement.Api.Controllers;
[Authorize(Roles = "Admin,Staff")]
[ApiController]
[Route("api/hostels/{hostelId:long}/tenants")]
public class TenantsController : ControllerBase
{
    private readonly HostelDbContext _db;
    private readonly ILogger<TenantsController> _logger;

    public TenantsController(
        HostelDbContext db,
        ILogger<TenantsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // GET: /api/hostels/1/tenants
    [HttpGet]
    public async Task<IActionResult> GetAll(
        long hostelId,
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Tenants
            .AsNoTracking()
            .Where(t => t.HostelId == hostelId);

        if (!includeInactive)
            query = query.Where(t => t.IsActive);

        var tenants = await query
            .OrderBy(t => t.FullName)
            .Select(t => new TenantResponse(
                t.Id,
                t.HostelId,
                t.RoomId,
                _db.Rooms
                    .Where(r => r.Id == t.RoomId)
                    .Select(r => r.RoomNumber)
                    .FirstOrDefault(),
                t.FullName,
                t.PhoneNumber,
                t.Email,
                t.EmergencyName,
                t.EmergencyPhone,
                t.MoveInDate,
                t.MoveOutDate,
                t.IsActive))
            .ToListAsync(cancellationToken);

        return Ok(tenants);
    }

    // GET: /api/hostels/1/tenants/5
    [HttpGet("{tenantId:long}")]
    public async Task<IActionResult> GetById(
        long hostelId,
        long tenantId,
        CancellationToken cancellationToken)
    {
        var tenant = await _db.Tenants
            .AsNoTracking()
            .Where(t => t.HostelId == hostelId && t.Id == tenantId)
            .Select(t => new TenantResponse(
                t.Id,
                t.HostelId,
                t.RoomId,
                _db.Rooms
                    .Where(r => r.Id == t.RoomId)
                    .Select(r => r.RoomNumber)
                    .FirstOrDefault(),
                t.FullName,
                t.PhoneNumber,
                t.Email,
                t.EmergencyName,
                t.EmergencyPhone,
                t.MoveInDate,
                t.MoveOutDate,
                t.IsActive))
            .FirstOrDefaultAsync(cancellationToken);

        return tenant is null
            ? NotFound(new { message = "Tenant not found." })
            : Ok(tenant);
    }

    // POST: /api/hostels/1/tenants
    [HttpPost]
    public async Task<IActionResult> Create(
        long hostelId,
        CreateTenantRequest request,
        CancellationToken cancellationToken)
    {
        var hostelExists = await _db.Hostels
            .AnyAsync(h => h.Id == hostelId && h.IsActive, cancellationToken);

        if (!hostelExists)
            return NotFound(new { message = "Hostel not found." });

        await using var transaction =
            await _db.Database.BeginTransactionAsync(cancellationToken);

        var tenant = new Tenant
        {
            HostelId = hostelId,
            FullName = request.FullName.Trim(),
            PhoneNumber = request.PhoneNumber.Trim(),
            Email = request.Email?.Trim(),
            EmergencyName = request.EmergencyName?.Trim(),
            EmergencyPhone = request.EmergencyPhone?.Trim(),
            MoveInDate = request.MoveInDate,
            IsActive = true
        };

        _db.Tenants.Add(tenant);
        await _db.SaveChangesAsync(cancellationToken);

        try
        {
            if (request.RoomId.HasValue)
            {
                // Calls the SQL function, which checks hostel scope and room capacity,
                // sets tenants.room_id, and records room_assignments history.
                await _db.Database
                    .SqlQuery<long>($"""
                        SELECT assign_tenant_to_room(
                            {hostelId},
                            {tenant.Id},
                            {request.RoomId.Value}
                        ) AS "Value"
                        """)
                    .SingleAsync(cancellationToken);

                await _db.Entry(tenant).ReloadAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            await transaction.RollbackAsync(cancellationToken);

            return Conflict(new { message = ex.MessageText });
        }

        _logger.LogInformation(
            "Created tenant {TenantId} for hostel {HostelId}",
            tenant.Id,
            hostelId);

        return CreatedAtAction(
            nameof(GetById),
            new { hostelId, tenantId = tenant.Id },
            new
            {
                tenant.Id,
                tenant.HostelId,
                tenant.RoomId,
                tenant.FullName,
                tenant.PhoneNumber,
                tenant.Email,
                tenant.MoveInDate,
                tenant.IsActive
            });
    }

    // PUT: /api/hostels/1/tenants/5
    [HttpPut("{tenantId:long}")]
    public async Task<IActionResult> Update(
        long hostelId,
        long tenantId,
        UpdateTenantRequest request,
        CancellationToken cancellationToken)
    {
        var tenant = await _db.Tenants.FirstOrDefaultAsync(
            t => t.HostelId == hostelId && t.Id == tenantId,
            cancellationToken);

        if (tenant is null)
            return NotFound(new { message = "Tenant not found." });

        tenant.FullName = request.FullName.Trim();
        tenant.PhoneNumber = request.PhoneNumber.Trim();
        tenant.Email = request.Email?.Trim();
        tenant.EmergencyName = request.EmergencyName?.Trim();
        tenant.EmergencyPhone = request.EmergencyPhone?.Trim();
        tenant.MoveInDate = request.MoveInDate;
        tenant.MoveOutDate = request.MoveOutDate;

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Updated tenant {TenantId} for hostel {HostelId}",
            tenantId,
            hostelId);

        return NoContent();
    }

    // PUT: /api/hostels/1/tenants/5/room
    [HttpPut("{tenantId:long}/room")]
    public async Task<IActionResult> AssignRoom(
        long hostelId,
        long tenantId,
        AssignTenantRoomRequest request,
        CancellationToken cancellationToken)
    {
        var tenantExists = await _db.Tenants.AnyAsync(
            t => t.HostelId == hostelId && t.Id == tenantId && t.IsActive,
            cancellationToken);

        if (!tenantExists)
            return NotFound(new { message = "Active tenant not found." });

        try
        {
            await _db.Database
                .SqlQuery<long>($"""
                    SELECT assign_tenant_to_room(
                        {hostelId},
                        {tenantId},
                        {request.RoomId}
                    ) AS "Value"
                    """)
                .SingleAsync(cancellationToken);
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            return Conflict(new { message = ex.MessageText });
        }

        _logger.LogInformation(
            "Assigned tenant {TenantId} to room {RoomId} in hostel {HostelId}",
            tenantId,
            request.RoomId,
            hostelId);

        return NoContent();
    }

    // DELETE: /api/hostels/1/tenants/5
    // Soft-deactivates the tenant and closes their active room assignment.
    [HttpDelete("{tenantId:long}")]
    public async Task<IActionResult> Deactivate(
        long hostelId,
        long tenantId,
        CancellationToken cancellationToken)
    {
        var tenant = await _db.Tenants.FirstOrDefaultAsync(
            t => t.HostelId == hostelId && t.Id == tenantId,
            cancellationToken);

        if (tenant is null)
            return NotFound(new { message = "Tenant not found." });

        if (!tenant.IsActive)
            return NoContent();

        await using var transaction =
            await _db.Database.BeginTransactionAsync(cancellationToken);

        tenant.IsActive = false;
        tenant.MoveOutDate = DateOnly.FromDateTime(DateTime.UtcNow);

        await _db.SaveChangesAsync(cancellationToken);

        await _db.Database.ExecuteSqlInterpolatedAsync(
            $"""
            UPDATE room_assignments
            SET checked_out_at = now()
            WHERE tenant_id = {tenantId}
              AND hostel_id = {hostelId}
              AND checked_out_at IS NULL
            """,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        _logger.LogInformation(
            "Deactivated tenant {TenantId} in hostel {HostelId}",
            tenantId,
            hostelId);

        return NoContent();
    }
}

public sealed record CreateTenantRequest(
    [param: Required]
    [param: StringLength(150, MinimumLength = 2)]
    string FullName,

    [param: Required]
    [param: StringLength(30)]
    string PhoneNumber,

    [param: EmailAddress]
    [param: StringLength(254)]
    string? Email,

    [param: StringLength(150)]
    string? EmergencyName,

    [param: StringLength(30)]
    string? EmergencyPhone,

    DateOnly MoveInDate,
    long? RoomId);

public sealed record UpdateTenantRequest(
    [param: Required]
    [param: StringLength(150, MinimumLength = 2)]
    string FullName,

    [param: Required]
    [param: StringLength(30)]
    string PhoneNumber,

    [param: EmailAddress]
    [param: StringLength(254)]
    string? Email,

    [param: StringLength(150)]
    string? EmergencyName,

    [param: StringLength(30)]
    string? EmergencyPhone,

    DateOnly MoveInDate,
    DateOnly? MoveOutDate);
public sealed record AssignTenantRoomRequest(long RoomId);

public sealed record TenantResponse(
    long Id,
    long HostelId,
    long? RoomId,
    string? RoomNumber,
    string FullName,
    string PhoneNumber,
    string? Email,
    string? EmergencyName,
    string? EmergencyPhone,
    DateOnly MoveInDate,
    DateOnly? MoveOutDate,
    bool IsActive);