using System.Text.Json;
using HostelManagement.Api.Data;
using HostelManagement.Api.Dtos;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Microsoft.AspNetCore.Authorization;
namespace HostelManagement.Api.Controllers;
[Authorize(Roles = "Admin,Staff")]
[ApiController]
[Route("api/hostels/{hostelId:long}/bills")]
public class BillsController : ControllerBase
{
    private static readonly HashSet<string> AllowedCategories =
    [
        "Rent",
        "Electricity",
        "Water",
        "Maintenance",
        "Other"
    ];

    private readonly HostelDbContext _db;
    private readonly ILogger<BillsController> _logger;

    public BillsController(
        HostelDbContext db,
        ILogger<BillsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // GET: /api/hostels/1/bills
    [HttpGet]
    public async Task<IActionResult> GetAll(
        long hostelId,
        CancellationToken cancellationToken)
    {
        var bills = await (
            from bill in _db.Bills.AsNoTracking()
            join tenant in _db.Tenants.AsNoTracking()
                on new { bill.HostelId, TenantId = bill.TenantId }
                equals new { tenant.HostelId, TenantId = tenant.Id }
            where bill.HostelId == hostelId
            orderby bill.DueDate descending
            select new
            {
                bill.Id,
                bill.HostelId,
                bill.TenantId,
                TenantName = tenant.FullName,
                bill.BillNumber,
                bill.PeriodStart,
                bill.PeriodEnd,
                bill.IssueDate,
                bill.DueDate,
                bill.TotalAmount,
                bill.Status,
                bill.PaidAt
            })
            .ToListAsync(cancellationToken);

        return Ok(bills);
    }

    // GET: /api/hostels/1/bills/10
    [HttpGet("{billId:long}")]
    public async Task<IActionResult> GetById(
        long hostelId,
        long billId,
        CancellationToken cancellationToken)
    {
        var bill = await _db.Bills
            .AsNoTracking()
            .Where(x => x.HostelId == hostelId && x.Id == billId)
            .Select(x => new
            {
                x.Id,
                x.HostelId,
                x.TenantId,
                x.BillNumber,
                x.PeriodStart,
                x.PeriodEnd,
                x.IssueDate,
                x.DueDate,
                x.Subtotal,
                x.TotalAmount,
                x.Status,
                x.PaidAt,
                x.Notes
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (bill is null)
            return NotFound(new { message = "Bill not found." });

        var items = await _db.BillItems
            .AsNoTracking()
            .Where(x => x.BillId == billId)
            .OrderBy(x => x.Id)
            .Select(x => new
            {
                x.Id,
                x.Category,
                x.Description,
                x.Quantity,
                x.UnitPrice,
                x.Amount
            })
            .ToListAsync(cancellationToken);

        return Ok(new { bill, items });
    }

    // POST: /api/hostels/1/bills
    [HttpPost]
    public async Task<IActionResult> Create(
        long hostelId,
        CreateBillRequest request,
        CancellationToken cancellationToken)
    {
        if (request.PeriodEnd < request.PeriodStart)
        {
            return BadRequest(new
            {
                message = "PeriodEnd must be on or after PeriodStart."
            });
        }

        if (request.Items.Any(item =>
                !AllowedCategories.Contains(item.Category, StringComparer.OrdinalIgnoreCase)))
        {
            return BadRequest(new
            {
                message = "Category must be Rent, Electricity, Water, Maintenance, or Other."
            });
        }

        var itemsForDatabase = request.Items.Select(item => new
        {
            category = NormalizeCategory(item.Category),
            description = item.Description.Trim(),
            quantity = item.Quantity,
            unit_price = item.UnitPrice
        });

        var itemsJson = JsonSerializer.Serialize(itemsForDatabase);
        long? createdByUserId = null; // Set from the authenticated user after auth is added.

        try
        {
            var billId = await _db.Database
                .SqlQuery<long>($"""
                    SELECT create_bill(
                        {hostelId},
                        {request.TenantId},
                        {request.BillNumber.Trim()},
                        {request.PeriodStart},
                        {request.PeriodEnd},
                        {request.DueDate},
                        {itemsJson}::jsonb,
                        {createdByUserId}::bigint
                    ) AS "Value"
                    """)
                .SingleAsync(cancellationToken);

            _logger.LogInformation(
                "Created bill {BillId} for tenant {TenantId} in hostel {HostelId}",
                billId,
                request.TenantId,
                hostelId);

            return CreatedAtAction(
                nameof(GetById),
                new { hostelId, billId },
                new { id = billId, message = "Bill created." });
        }
        catch (PostgresException ex) when (
            ex.SqlState == "P0001" || ex.SqlState == "23505")
        {
            return Conflict(new { message = ex.MessageText });
        }
    }

    private static string NormalizeCategory(string category) =>
        AllowedCategories.First(x =>
            string.Equals(x, category, StringComparison.OrdinalIgnoreCase));
}