using HostelManagement.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HostelManagement.Api.Data;

public class HostelDbContext : DbContext
{
    public HostelDbContext(DbContextOptions<HostelDbContext> options)
        : base(options)
    {
    }

    public DbSet<Hostel> Hostels => Set<Hostel>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Bill> Bills => Set<Bill>();
    public DbSet<BillItem> BillItems => Set<BillItem>();
    public DbSet<ReminderSchedule> ReminderSchedules => Set<ReminderSchedule>();
    public DbSet<PaymentOrder> PaymentOrders => Set<PaymentOrder>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Complaint> Complaints => Set<Complaint>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
    public DbSet<HostelSetting> HostelSettings => Set<HostelSetting>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserHostelRole> UserHostelRoles => Set<UserHostelRole>();


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Hostel>(entity =>
        {
            entity.ToTable("hostels");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(150);
            entity.Property(x => x.Address).HasColumnName("address").HasMaxLength(500);
            entity.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(30);
            entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(254);
            entity.Property(x => x.TimezoneName).HasColumnName("timezone_name").HasMaxLength(80);
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAdd();
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAddOrUpdate();
        });

        modelBuilder.Entity<Room>(entity =>
        {
            entity.ToTable("rooms");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.HostelId).HasColumnName("hostel_id");
            entity.Property(x => x.RoomNumber).HasColumnName("room_number").HasMaxLength(30);
            entity.Property(x => x.Capacity).HasColumnName("capacity");
            entity.Property(x => x.FloorNumber).HasColumnName("floor_number");
            entity.Property(x => x.Notes).HasColumnName("notes");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAdd();
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAddOrUpdate();

            entity.HasAlternateKey(x => new { x.HostelId, x.Id });

            entity.HasIndex(x => new { x.HostelId, x.RoomNumber })
                .IsUnique();

            entity.HasOne<Hostel>()
                .WithMany()
                .HasForeignKey(x => x.HostelId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.ToTable("tenants");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.HostelId).HasColumnName("hostel_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.RoomId).HasColumnName("room_id");
            entity.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(150);
            entity.Property(x => x.PhoneNumber).HasColumnName("phone_number").HasMaxLength(30);
            entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(254);
            entity.Property(x => x.EmergencyName).HasColumnName("emergency_name").HasMaxLength(150);
            entity.Property(x => x.EmergencyPhone).HasColumnName("emergency_phone").HasMaxLength(30);
            entity.Property(x => x.MoveInDate).HasColumnName("move_in_date").HasColumnType("date");
            entity.Property(x => x.MoveOutDate).HasColumnName("move_out_date").HasColumnType("date");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAdd();
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAddOrUpdate();

            entity.HasAlternateKey(x => new { x.HostelId, x.Id });

            entity.HasOne<Hostel>()
                .WithMany()
                .HasForeignKey(x => x.HostelId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<Room>()
                .WithMany()
                .HasForeignKey(x => new { x.HostelId, x.RoomId })
                .HasPrincipalKey(x => new { x.HostelId, x.Id })
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Bill>(entity =>
        {
            entity.ToTable("bills");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.HostelId).HasColumnName("hostel_id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.BillNumber).HasColumnName("bill_number").HasMaxLength(50);
            entity.Property(x => x.PeriodStart).HasColumnName("period_start").HasColumnType("date");
            entity.Property(x => x.PeriodEnd).HasColumnName("period_end").HasColumnType("date");
            entity.Property(x => x.IssueDate).HasColumnName("issue_date").HasColumnType("date");
            entity.Property(x => x.DueDate).HasColumnName("due_date").HasColumnType("date");
            entity.Property(x => x.Subtotal).HasColumnName("subtotal").HasPrecision(12, 2);
            entity.Property(x => x.TotalAmount).HasColumnName("total_amount").HasPrecision(12, 2);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(20);
            entity.Property(x => x.PaidAt).HasColumnName("paid_at");
            entity.Property(x => x.Notes).HasColumnName("notes");
            entity.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAdd();
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAddOrUpdate();

            entity.HasAlternateKey(x => new { x.HostelId, x.Id });

            entity.HasOne<Tenant>()
                .WithMany()
                .HasForeignKey(x => new { x.HostelId, x.TenantId })
                .HasPrincipalKey(x => new { x.HostelId, x.Id })
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<BillItem>(entity =>
        {
            entity.ToTable("bill_items");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.BillId).HasColumnName("bill_id");
            entity.Property(x => x.Category).HasColumnName("category").HasMaxLength(40);
            entity.Property(x => x.Description).HasColumnName("description").HasMaxLength(250);
            entity.Property(x => x.Quantity).HasColumnName("quantity").HasPrecision(10, 2);
            entity.Property(x => x.UnitPrice).HasColumnName("unit_price").HasPrecision(12, 2);
            entity.Property(x => x.Amount).HasColumnName("amount")
                .HasPrecision(12, 2)
                .ValueGeneratedOnAddOrUpdate();

            entity.HasOne<Bill>()
                .WithMany()
                .HasForeignKey(x => x.BillId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<ReminderSchedule>(entity =>
        {
            entity.ToTable("reminder_schedules");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.BillId).HasColumnName("bill_id");
            entity.Property(x => x.Channel).HasColumnName("channel").HasMaxLength(20);
            entity.Property(x => x.ScheduledAt).HasColumnName("scheduled_at");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(20);
            entity.Property(x => x.AttemptCount).HasColumnName("attempt_count");
            entity.Property(x => x.LastError).HasColumnName("last_error");
            entity.Property(x => x.ProcessedAt).HasColumnName("processed_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAdd();

            entity.HasOne<Bill>()
                .WithMany()
                .HasForeignKey(x => x.BillId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.BillId, x.Channel, x.ScheduledAt })
                .IsUnique();
        });
        modelBuilder.Entity<PaymentOrder>(entity =>
        {
            entity.ToTable("payment_orders");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.HostelId).HasColumnName("hostel_id");
            entity.Property(x => x.BillId).HasColumnName("bill_id");
            entity.Property(x => x.GatewayOrderId).HasColumnName("gateway_order_id").HasMaxLength(100);
            entity.Property(x => x.GatewayPaymentId).HasColumnName("gateway_payment_id").HasMaxLength(100);
            entity.Property(x => x.Amount).HasColumnName("amount").HasPrecision(12, 2);
            entity.Property(x => x.AmountPaise).HasColumnName("amount_paise");
            entity.Property(x => x.Currency).HasColumnName("currency").HasMaxLength(3);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(20);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAdd();
            entity.Property(x => x.PaidAt).HasColumnName("paid_at");

            entity.HasOne<Bill>()
                .WithMany()
                .HasForeignKey(x => new { x.HostelId, x.BillId })
                .HasPrincipalKey(x => new { x.HostelId, x.Id })
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("notifications");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.HostelId).HasColumnName("hostel_id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.BillId).HasColumnName("bill_id");
            entity.Property(x => x.Channel).HasColumnName("channel").HasMaxLength(20);
            entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(160);
            entity.Property(x => x.Message).HasColumnName("message");
            entity.Property(x => x.ReadAt).HasColumnName("read_at");
            entity.Property(x => x.SentAt).HasColumnName("sent_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAdd();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAdd();

            entity.HasOne<Hostel>()
                .WithMany()
                .HasForeignKey(x => x.HostelId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<Complaint>(entity =>
        {
            entity.ToTable("complaints");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.HostelId).HasColumnName("hostel_id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.RoomId).HasColumnName("room_id");
            entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(180);
            entity.Property(x => x.Description).HasColumnName("description");
            entity.Property(x => x.Category).HasColumnName("category").HasMaxLength(50);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(20);
            entity.Property(x => x.Priority).HasColumnName("priority").HasMaxLength(15);
            entity.Property(x => x.AssignedToUserId).HasColumnName("assigned_to_user_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAdd();
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAddOrUpdate();
            entity.Property(x => x.ResolvedAt).HasColumnName("resolved_at");
        });
        modelBuilder.Entity<AttendanceRecord>(entity =>
        {
            entity.ToTable("attendance_records");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.HostelId).HasColumnName("hostel_id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.AttendanceDate)
                .HasColumnName("attendance_date")
                .HasColumnType("date");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(15);
            entity.Property(x => x.Notes).HasColumnName("notes");
            entity.Property(x => x.RecordedByUserId).HasColumnName("recorded_by");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAdd();

            entity.HasIndex(x => new { x.TenantId, x.AttendanceDate })
                .IsUnique();

            entity.HasOne<Tenant>()
                .WithMany()
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<HostelSetting>(entity =>
        {
            entity.ToTable("hostel_settings");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.HostelId).HasColumnName("hostel_id");
            entity.Property(x => x.SettingKey).HasColumnName("setting_key").HasMaxLength(100);
            entity.Property(x => x.SettingValue).HasColumnName("setting_value").HasColumnType("jsonb");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAddOrUpdate();

            entity.HasIndex(x => new { x.HostelId, x.SettingKey })
                .IsUnique();
        });
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.ToTable("app_users");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(254);
            entity.Property(x => x.PasswordHash).HasColumnName("password_hash");
            entity.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(150);
            entity.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(30);
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAdd();
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAddOrUpdate();

            entity.HasIndex(x => x.Email).IsUnique();
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("roles");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(40);
        });

        modelBuilder.Entity<UserHostelRole>(entity =>
        {
            entity.ToTable("user_hostel_roles");
            entity.HasKey(x => new { x.UserId, x.HostelId, x.RoleId });

            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.HostelId).HasColumnName("hostel_id");
            entity.Property(x => x.RoleId).HasColumnName("role_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at")
                .HasDefaultValueSql("now()").ValueGeneratedOnAdd();
        });
    }
}