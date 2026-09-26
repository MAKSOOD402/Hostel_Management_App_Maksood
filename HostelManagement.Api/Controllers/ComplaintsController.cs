using System.ComponentModel.DataAnnotations;
using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
namespace HostelManagement.Api.Controllers;
[Authorize(Roles = "Admin,Staff")]
[ApiController]
[Route("api/hostels/{hostelId:long}/complaints")]
public class ComplaintsController : ControllerBase
{
    private static readonly string[] AllowedStatuses =
        ["Open", "InProgress", "Resolved", "Rejected"];

    private static readonly string[] AllowedPriorities =
        ["Low", "Normal", "High", "Urgent"];

    private readonly HostelDbContext _db;
    private readonly ILogger<ComplaintsController> _logger;

    public ComplaintsController(
        HostelDbContext db,
        ILogger<ComplaintsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // GET /api/hostels/1/complaints?status=Open
    [HttpGet]
    public async Task<IActionResult> GetAll(
        long hostelId,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var query = _db.Complaints
            .AsNoTracking()
            .Where(c => c.HostelId == hostelId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!AllowedStatuses.Contains(status, StringComparer.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    message = "Status must be Open, InProgress, Resolved, or Rejected."
                });
            }

            var normalizedStatus = Normalize(status, AllowedStatuses);
            query = query.Where(c => c.Status == normalizedStatus);
        }

        var complaints = await (
            from complaint in query
            join tenant in _db.Tenants.AsNoTracking()
                on complaint.TenantId equals tenant.Id
            orderby complaint.CreatedAt descending
            select new
            {
                complaint.Id,
                complaint.HostelId,
                complaint.TenantId,
                TenantName = tenant.FullName,
                complaint.RoomId,
                complaint.Title,
                complaint.Description,
                complaint.Category,
                complaint.Status,
                complaint.Priority,
                complaint.CreatedAt,
                complaint.UpdatedAt,
                complaint.ResolvedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(complaints);
    }

    // POST /api/hostels/1/complaints
    [HttpPost]
    public async Task<IActionResult> Create(
        long hostelId,
        CreateComplaintRequest request,
        CancellationToken cancellationToken)
    {
        var tenant = await _db.Tenants
            .AsNoTracking()
            .Where(t => t.HostelId == hostelId
                        && t.Id == request.TenantId
                        && t.IsActive)
            .Select(t => new { t.Id, t.RoomId })
            .FirstOrDefaultAsync(cancellationToken);

        if (tenant is null)
            return NotFound(new { message = "Active tenant not found in this hostel." });

        if (!AllowedPriorities.Contains(
                request.Priority,
                StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                message = "Priority must be Low, Normal, High, or Urgent."
            });
        }

        var complaint = new Complaint
        {
            HostelId = hostelId,
            TenantId = tenant.Id,
            RoomId = tenant.RoomId,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            Category = string.IsNullOrWhiteSpace(request.Category)
                ? "General"
                : request.Category.Trim(),
            Priority = Normalize(request.Priority, AllowedPriorities),
            Status = "Open"
        };

        _db.Complaints.Add(complaint);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Created complaint {ComplaintId} for tenant {TenantId} in hostel {HostelId}",
            complaint.Id,
            tenant.Id,
            hostelId);

        return Created(
            $"/api/hostels/{hostelId}/complaints/{complaint.Id}",
            new
            {
                complaint.Id,
                complaint.HostelId,
                complaint.TenantId,
                complaint.Title,
                complaint.Status,
                complaint.Priority,
                complaint.CreatedAt
            });
    }

    // PATCH /api/hostels/1/complaints/5/status
    [HttpPatch("{complaintId:long}/status")]
    public async Task<IActionResult> UpdateStatus(
        long hostelId,
        long complaintId,
        UpdateComplaintStatusRequest request,
        CancellationToken cancellationToken)
    {
        if (!AllowedStatuses.Contains(
                request.Status,
                StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                message = "Status must be Open, InProgress, Resolved, or Rejected."
            });
        }

        var complaint = await _db.Complaints.FirstOrDefaultAsync(
            c => c.HostelId == hostelId && c.Id == complaintId,
            cancellationToken);

        if (complaint is null)
            return NotFound(new { message = "Complaint not found." });

        complaint.Status = Normalize(request.Status, AllowedStatuses);
        complaint.ResolvedAt = complaint.Status == "Resolved"
            ? DateTimeOffset.UtcNow
            : null;

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Changed complaint {ComplaintId} status to {Status}",
            complaintId,
            complaint.Status);

        return Ok(new
        {
            complaint.Id,
            complaint.Status,
            complaint.ResolvedAt
        });
    }

    private static string Normalize(string value, IEnumerable<string> allowed) =>
        allowed.First(x => string.Equals(
            x,
            value,
            StringComparison.OrdinalIgnoreCase));
}

public sealed class CreateComplaintRequest
{
    [Range(1, long.MaxValue)]
    public long TenantId { get; set; }

    [Required]
    [StringLength(180, MinimumLength = 3)]
    public string Title { get; set; } = "";

    [Required]
    [StringLength(5000, MinimumLength = 5)]
    public string Description { get; set; } = "";

    [StringLength(50)]
    public string? Category { get; set; }

    public string Priority { get; set; } = "Normal";
}

public sealed class UpdateComplaintStatusRequest
{
    [Required]
    public string Status { get; set; } = "";
}