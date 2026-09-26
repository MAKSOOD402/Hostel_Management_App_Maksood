using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using HostelManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HostelManagement.Api.Controllers;
using Microsoft.AspNetCore.Authorization;
[Authorize(Roles = "Admin,Staff")]
[ApiController]
[Route("api/hostels/{hostelId:long}/bills/{billId:long}/razorpay-order")]
public class RazorpayController : ControllerBase
{
    private readonly HostelDbContext _db;
    private readonly RazorpayOrderService _razorpay;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RazorpayController> _logger;

    public RazorpayController(
        HostelDbContext db,
        RazorpayOrderService razorpay,
        IConfiguration configuration,
        ILogger<RazorpayController> logger)
    {
        _db = db;
        _razorpay = razorpay;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder(
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
                x.BillNumber,
                x.TotalAmount,
                x.Status
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (bill is null)
            return NotFound(new { message = "Bill not found." });

        if (bill.Status is "Paid" or "Cancelled")
        {
            return Conflict(new
            {
                message = $"A Razorpay order cannot be created for a {bill.Status} bill."
            });
        }

        if (bill.TotalAmount <= 0)
            return BadRequest(new { message = "Bill amount must be greater than zero." });

        var paiseDecimal = bill.TotalAmount * 100m;

        if (paiseDecimal != decimal.Truncate(paiseDecimal))
        {
            return BadRequest(new
            {
                message = "Bill amount cannot have fractions smaller than one paisa."
            });
        }

        var amountPaise = decimal.ToInt64(paiseDecimal);
        var receipt = $"HM{Guid.NewGuid():N}";

        var razorpayOrder = await _razorpay.CreateOrder(
            amountPaise,
            receipt,
            cancellationToken);

        if (razorpayOrder.Amount != amountPaise ||
            razorpayOrder.Currency != "INR")
        {
            _logger.LogError(
                "Razorpay order {OrderId} returned unexpected amount or currency",
                razorpayOrder.Id);

            return StatusCode(
                StatusCodes.Status502BadGateway,
                new { message = "Razorpay returned an unexpected order response." });
        }

        var paymentOrder = new PaymentOrder
        {
            HostelId = hostelId,
            BillId = billId,
            GatewayOrderId = razorpayOrder.Id,
            Amount = bill.TotalAmount,
            AmountPaise = amountPaise,
            Currency = "INR",
            Status = "Created"
        };

        _db.PaymentOrders.Add(paymentOrder);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Created Razorpay order {GatewayOrderId} for bill {BillId}",
            razorpayOrder.Id,
            billId);

        return Ok(new
        {
            orderId = razorpayOrder.Id,
            amount = amountPaise,
            currency = "INR",
            keyId = _configuration["Razorpay:KeyId"],
            billNumber = bill.BillNumber
        });
    }
}