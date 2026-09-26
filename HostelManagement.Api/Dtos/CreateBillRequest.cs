using System.ComponentModel.DataAnnotations;

namespace HostelManagement.Api.Dtos;

public sealed class CreateBillRequest
{
    [Required]
    [StringLength(50, MinimumLength = 1)]
    public string BillNumber { get; set; } = "";

    [Range(1, long.MaxValue)]
    public long TenantId { get; set; }

    public DateOnly PeriodStart { get; set; }

    public DateOnly PeriodEnd { get; set; }

    public DateOnly DueDate { get; set; }

    [Required]
    [MinLength(1)]
    public List<CreateBillItemRequest> Items { get; set; } = [];

    [StringLength(1000)]
    public string? Notes { get; set; }
}

public sealed class CreateBillItemRequest
{
    [Required]
    public string Category { get; set; } = "";

    [Required]
    [StringLength(250, MinimumLength = 1)]
    public string Description { get; set; } = "";

    [Range(typeof(decimal), "0.01", "100000")]
    public decimal Quantity { get; set; } = 1;

    [Range(typeof(decimal), "0", "999999999")]
    public decimal UnitPrice { get; set; }
}