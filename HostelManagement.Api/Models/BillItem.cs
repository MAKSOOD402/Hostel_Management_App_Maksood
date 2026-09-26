namespace HostelManagement.Api.Models;

public class BillItem
{
    public long Id { get; set; }
    public long BillId { get; set; }
    public required string Category { get; set; }
    public required string Description { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
}