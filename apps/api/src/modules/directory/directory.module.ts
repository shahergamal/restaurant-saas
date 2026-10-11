import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CryptoService } from '../../common/crypto.service';
import { RequirePermissions } from '../../common/decorators';
import { DbService } from '../../common/prisma.service';
import { currentBranchId } from '../../common/tenant-context';
import { ZodPipe } from '../../common/zod.pipe';

const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });

/** Read-only lists for Sales, Customers and Suppliers. */
@Injectable()
class DirectoryService {
  constructor(
    private readonly db: DbService,
    private readonly crypto: CryptoService,
  ) {}

  async sales(page: number, pageSize: number) {
    const where = { branchId: currentBranchId(), status: 'paid' as const };
    const [total, rows] = await Promise.all([
      this.db.client.order.count({ where }),
      this.db.client.order.findMany({
        where,
        orderBy: { closedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { payments: { select: { method: true, amountHalala: true } }, invoices: { select: { icv: true, status: true, type: true } }, table: { select: { label: true } } },
      }),
    ]);
    return {
      total, page, pageSize,
      items: rows.map((o) => ({
        id: o.id, number: o.number, channel: o.channel, table: o.table?.label ?? null, closedAt: o.closedAt, total: o.totalHalala, vat: o.vatHalala,
        methods: [...new Set(o.payments.map((p) => p.method))], invoice: o.invoices[0] ?? null,
      })),
    };
  }

  async customers(page: number, pageSize: number) {
    const [total, rows] = await Promise.all([
      this.db.client.customer.count(),
      this.db.client.customer.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return {
      total, page, pageSize,
      items: rows.map((c) => {
        const phone = c.phoneEnc ? this.crypto.decrypt(c.phoneEnc) : null;
        return { id: c.id, name: c.name, phoneMasked: phone ? phone.slice(0, 4) + '•••' + phone.slice(-3) : null, createdAt: c.createdAt };
      }),
    };
  }

  suppliers() {
    return this.db.client.supplier.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { ingredients: true, purchaseOrders: true } } } });
  }
}

@ApiTags('directory')
@Controller()
class DirectoryController {
  constructor(private readonly svc: DirectoryService) {}

  @Get('sales')
  @RequirePermissions('reports.view')
  sales(@Query(new ZodPipe(pageQuery)) q: z.infer<typeof pageQuery>) {
    return this.svc.sales(q.page, q.pageSize);
  }

  @Get('customers')
  @RequirePermissions('orders.view')
  customers(@Query(new ZodPipe(pageQuery)) q: z.infer<typeof pageQuery>) {
    return this.svc.customers(q.page, q.pageSize);
  }

  @Get('suppliers')
  @RequirePermissions('inventory.view')
  suppliers() {
    return this.svc.suppliers();
  }
}

@Module({ controllers: [DirectoryController], providers: [DirectoryService] })
export class DirectoryModule {}
