import { vi } from "vitest";

export function createInMemoryPrisma() {
  const users: any[] = [];
  const companies: any[] = [];
  const memberships: any[] = [];
  const accounts: any[] = [];
  const warehouses: any[] = [];
  const sequences: any[] = [];
  const fiscalYears: any[] = [];
  const journalEntries: any[] = [];
  const journalLines: any[] = [];
  const auditLogs: any[] = [];

  const categories: any[] = [];
  const contacts: any[] = [];
  const taxRates: any[] = [];
  const products: any[] = [];
  const stockMovements: any[] = [];
  const invoices: any[] = [];
  const invoiceItems: any[] = [];
  const bills: any[] = [];
  const billItems: any[] = [];
  const payments: any[] = [];
  const creditNotes: any[] = [];
  const creditNoteItems: any[] = [];
  const bankAccounts: any[] = [];
  const bankStatements: any[] = [];
  const bankStatementLines: any[] = [];
  const currencyRates: any[] = [];
  const recurringInvoices: any[] = [];
  const emailLogs: any[] = [];

  const db = {
    user: {
      create: vi.fn(async ({ data }: any) => {
        const u = { id: `user-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...data };
        users.push(u);
        return u;
      }),
      findUnique: vi.fn(async ({ where, select }: any) => {
        const u = users.find((x) => (where.id && x.id === where.id) || (where.email && x.email === where.email));
        if (!u) return null;

        const userMemberships = memberships
          .filter((m) => m.userId === u.id)
          .map((m) => {
            const comp = companies.find((c) => c.id === m.companyId);
            return { ...m, company: comp };
          });

        const result = {
          ...u,
          memberships: userMemberships
        };

        if (select) {
          const selected: any = {};
          Object.keys(select).forEach((k) => {
            if (select[k]) {
              selected[k] = (result as any)[k];
            }
          });
          return selected;
        }

        return result;
      }),
      findMany: vi.fn(async () => users)
    },
    company: {
      create: vi.fn(async ({ data }: any) => {
        const c = { id: `comp-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...data };
        companies.push(c);
        return c;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        return companies.find((x) => x.id === where.id) || null;
      }),
      findMany: vi.fn(async () => companies),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = companies.findIndex((x) => x.id === where.id);
        if (idx >= 0) {
          companies[idx] = { ...companies[idx], ...data };
          return companies[idx];
        }
        return null;
      })
    },
    membership: {
      create: vi.fn(async ({ data, include }: any) => {
        const m = { ...data };
        memberships.push(m);
        let res: any = { ...m };
        if (include?.user) {
          res.user = users.find((u) => u.id === m.userId);
        }
        return res;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const { userId, companyId } = where.userId_companyId || {};
        const found = memberships.find((m) => m.userId === userId && m.companyId === companyId);
        if (!found) return null;
        const comp = companies.find((c) => c.id === found.companyId);
        const usr = users.find((u) => u.id === found.userId);
        return { ...found, company: comp, user: usr };
      }),
      findMany: vi.fn(async ({ where, include }: any) => {
        return memberships
          .filter((m) => {
            if (where?.userId && m.userId !== where.userId) return false;
            if (where?.companyId && m.companyId !== where.companyId) return false;
            return true;
          })
          .map((m) => {
            let res: any = { ...m };
            if (include?.company) {
              res.company = companies.find((c) => c.id === m.companyId);
            }
            if (include?.user) {
              res.user = users.find((u) => u.id === m.userId);
            }
            return res;
          });
      }),
      update: vi.fn(async ({ where, data, include }: any) => {
        const { userId, companyId } = where.userId_companyId || {};
        const idx = memberships.findIndex((m) => m.userId === userId && m.companyId === companyId);
        if (idx >= 0) {
          memberships[idx] = { ...memberships[idx], ...data };
          let res: any = { ...memberships[idx] };
          if (include?.user) {
            res.user = users.find((u) => u.id === userId);
          }
          return res;
        }
        return null;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const { userId, companyId } = where.userId_companyId || {};
        const idx = memberships.findIndex((m) => m.userId === userId && m.companyId === companyId);
        if (idx >= 0) {
          return memberships.splice(idx, 1)[0];
        }
        return null;
      }),
      count: vi.fn(async ({ where }: any) => {
        return memberships.filter((m) => {
          if (where?.companyId && m.companyId !== where.companyId) return false;
          if (where?.role && m.role !== where.role) return false;
          return true;
        }).length;
      })
    },
    account: {
      create: vi.fn(async ({ data }: any) => {
        const a = { id: `acc-${Date.now()}-${Math.random()}`, ...data };
        accounts.push(a);
        return a;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.companyId_code) {
          return (
            accounts.find(
              (x) => x.companyId === where.companyId_code.companyId && x.code === where.companyId_code.code
            ) || null
          );
        }
        return accounts.find((x) => x.id === where.id) || null;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          accounts.find((x) => {
            if (where.id && x.id !== where.id) return false;
            if (where.companyId && x.companyId !== where.companyId) return false;
            if (where.code && x.code !== where.code) return false;
            if (where.systemKey) {
              if (where.systemKey.in && !where.systemKey.in.includes(x.systemKey)) return false;
              if (typeof where.systemKey === "string" && x.systemKey !== where.systemKey) return false;
            }
            return true;
          }) || null
        );
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return accounts.filter((x) => {
          if (where?.companyId && x.companyId !== where.companyId) return false;
          if (where?.id?.in && !where.id.in.includes(x.id)) return false;
          if (where?.type) {
            if (typeof where.type === "string" && x.type !== where.type) return false;
            if (where.type.in && !where.type.in.includes(x.type)) return false;
          }
          if (where?.isActive !== undefined && x.isActive !== where.isActive) return false;
          if (where?.systemKey?.in && !where.systemKey.in.includes(x.systemKey)) return false;
          if (where?.OR && Array.isArray(where.OR)) {
            const matchesOr = where.OR.some((cond: any) => {
              if (cond.systemKey?.in && cond.systemKey.in.includes(x.systemKey)) return true;
              if (cond.code?.in && cond.code.in.includes(x.code)) return true;
              return false;
            });
            if (!matchesOr) return false;
          }
          return true;
        });
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = accounts.findIndex((x) => x.id === where.id);
        if (idx >= 0) {
          accounts[idx] = { ...accounts[idx], ...data };
          return accounts[idx];
        }
        return null;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = accounts.findIndex((x) => x.id === where.id);
        if (idx >= 0) {
          const deleted = accounts.splice(idx, 1)[0];
          return deleted;
        }
        return null;
      }),
      count: vi.fn(async ({ where }: any) => {
        return accounts.filter((x) => {
          if (where.companyId && x.companyId !== where.companyId) return false;
          if (where.parentId && x.parentId !== where.parentId) return false;
          return true;
        }).length;
      })
    },
    warehouse: {
      create: vi.fn(async ({ data }: any) => {
        const w = { id: `wh-${Date.now()}-${Math.random()}`, ...data };
        warehouses.push(w);
        return w;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          warehouses.find(
            (w) =>
              (!where.id || w.id === where.id) &&
              (!where.companyId || w.companyId === where.companyId) &&
              (where.isDefault === undefined || w.isDefault === where.isDefault)
          ) || null
        );
      }),
      findMany: vi.fn(async ({ where, orderBy }: any) => {
        return warehouses.filter((w) => !where?.companyId || w.companyId === where.companyId);
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = warehouses.findIndex((w) => w.id === where.id);
        if (idx >= 0) {
          warehouses[idx] = { ...warehouses[idx], ...data };
          return warehouses[idx];
        }
        return null;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const w of warehouses) {
          if (!where.companyId || w.companyId === where.companyId) {
            if (!where.id || (where.id.not && w.id !== where.id.not)) {
              Object.assign(w, data);
              count++;
            }
          }
        }
        return { count };
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = warehouses.findIndex((w) => w.id === where.id);
        if (idx >= 0) {
          return warehouses.splice(idx, 1)[0];
        }
        return null;
      })
    },
    category: {
      create: vi.fn(async ({ data }: any) => {
        const cat = { id: `cat-${Date.now()}-${Math.random()}`, ...data };
        categories.push(cat);
        return cat;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          categories.find(
            (c) => (!where.id || c.id === where.id) && (!where.companyId || c.companyId === where.companyId)
          ) || null
        );
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return categories.filter((c) => !where?.companyId || c.companyId === where.companyId);
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = categories.findIndex((c) => c.id === where.id);
        if (idx >= 0) {
          categories[idx] = { ...categories[idx], ...data };
          return categories[idx];
        }
        return null;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = categories.findIndex((c) => c.id === where.id);
        if (idx >= 0) {
          return categories.splice(idx, 1)[0];
        }
        return null;
      })
    },
    documentSequence: {
      create: vi.fn(async ({ data }: any) => {
        const s = { ...data };
        sequences.push(s);
        return s;
      }),
      upsert: vi.fn(async ({ where, update, create }: any) => {
        const { companyId, type, year } = where.companyId_type_year;
        let seq = sequences.find((s) => s.companyId === companyId && s.type === type && s.year === year);
        if (seq) {
          if (update?.last?.increment) {
            seq.last += update.last.increment;
          }
          return seq;
        }
        seq = { companyId, type, year, last: create.last || 1 };
        sequences.push(seq);
        return seq;
      })
    },
    fiscalYear: {
      create: vi.fn(async ({ data }: any) => {
        const fy = { id: `fy-${Date.now()}-${Math.random()}`, isClosed: false, ...data };
        fiscalYears.push(fy);
        return fy;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          fiscalYears.find((fy) => {
            if (where?.id && fy.id !== where.id) return false;
            if (where?.companyId && fy.companyId !== where.companyId) return false;
            if (where?.isClosed !== undefined && fy.isClosed !== where.isClosed) return false;
            if (where?.startDate?.lte && new Date(fy.startDate).getTime() > new Date(where.startDate.lte).getTime()) return false;
            if (where?.endDate?.gte && new Date(fy.endDate).getTime() < new Date(where.endDate.gte).getTime()) return false;
            return true;
          }) || null
        );
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return fiscalYears.filter((fy) => !where?.companyId || fy.companyId === where.companyId);
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = fiscalYears.findIndex((fy) => fy.id === where.id);
        if (idx >= 0) {
          fiscalYears[idx] = { ...fiscalYears[idx], ...data };
          return fiscalYears[idx];
        }
        return null;
      })
    },
    journalEntry: {
      create: vi.fn(async ({ data }: any) => {
        const id = `entry-${Date.now()}-${Math.random()}`;
        const entry = {
          id,
          number: data.number,
          date: data.date,
          narration: data.narration,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          createdById: data.createdById,
          companyId: data.companyId,
          status: data.status || "DRAFT",
          createdAt: new Date()
        };
        journalEntries.push(entry);

        if (data.lines?.create) {
          for (const line of data.lines.create) {
            journalLines.push({
              id: `line-${Date.now()}-${Math.random()}`,
              entryId: id,
              ...line
            });
          }
        }

        return {
          ...entry,
          lines: journalLines.filter((l) => l.entryId === id)
        };
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        const found = journalEntries.find((e) => {
          if (where?.id && e.id !== where.id) return false;
          if (where?.companyId && e.companyId !== where.companyId) return false;
          if (where?.sourceType && e.sourceType !== where.sourceType) return false;
          if (where?.sourceId && e.sourceId !== where.sourceId) return false;
          if (where?.status && e.status !== where.status) return false;
          return true;
        });
        if (!found) return null;
        return {
          ...found,
          lines: journalLines.filter((l) => l.entryId === found.id)
        };
      }),
      findMany: vi.fn(async ({ where }: any) => {
        const filtered = journalEntries.filter((e) => {
          if (where?.companyId && e.companyId !== where.companyId) return false;
          if (where?.status && e.status !== where.status) return false;
          return true;
        });
        return filtered.map((entry) => ({
          ...entry,
          lines: journalLines.filter((l) => l.entryId === entry.id)
        }));
      }),
      count: vi.fn(async ({ where }: any) => {
        return journalEntries.filter((e) => {
          if (where?.companyId && e.companyId !== where.companyId) return false;
          if (where?.status && e.status !== where.status) return false;
          return true;
        }).length;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = journalEntries.findIndex((e) => e.id === where.id);
        if (idx >= 0) {
          journalEntries[idx] = { ...journalEntries[idx], ...data };
          return journalEntries[idx];
        }
        return null;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = journalEntries.findIndex((e) => e.id === where.id);
        if (idx >= 0) {
          return journalEntries.splice(idx, 1)[0];
        }
        return null;
      })
    },
    journalLine: {
      findMany: vi.fn(async ({ where, include, select, orderBy }: any) => {
        return journalLines
          .filter((l) => {
            if (where?.contactId && l.contactId !== where.contactId) return false;
            if (where?.accountId && typeof where.accountId === "string" && l.accountId !== where.accountId) return false;
            if (where?.accountId?.in && !where.accountId.in.includes(l.accountId)) return false;
            if (where?.entry) {
              const ent = journalEntries.find((e) => e.id === l.entryId);
              if (!ent) return false;
              if (where.entry.companyId && ent.companyId !== where.entry.companyId) return false;
              if (where.entry.status && ent.status !== where.entry.status) return false;
              if (where.entry.date) {
                const ed = new Date(ent.date);
                if (where.entry.date.lt && !(ed < new Date(where.entry.date.lt))) return false;
                if (where.entry.date.lte && !(ed <= new Date(where.entry.date.lte))) return false;
                if (where.entry.date.gt && !(ed > new Date(where.entry.date.gt))) return false;
                if (where.entry.date.gte && !(ed >= new Date(where.entry.date.gte))) return false;
              }
            }
            return true;
          })
          .map((l) => {
            const res: any = { ...l };
            if (include?.account || select?.account) {
              res.account = accounts.find((a) => a.id === l.accountId);
            }
            if (include?.entry || select?.entry) {
              res.entry = journalEntries.find((e) => e.id === l.entryId);
            }
            return res;
          });
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        let count = 0;
        for (let i = journalLines.length - 1; i >= 0; i--) {
          if (journalLines[i].entryId === where.entryId) {
            journalLines.splice(i, 1);
            count++;
          }
        }
        return { count };
      }),
      count: vi.fn(async ({ where }: any) => {
        return journalLines.filter((l) => {
          if (where.accountId && l.accountId !== where.accountId) return false;
          return true;
        }).length;
      })
    },
    contact: {
      create: vi.fn(async ({ data }: any) => {
        const c = { id: `contact-${Date.now()}-${Math.random()}`, ...data };
        contacts.push(c);
        return c;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return contacts.find((c) => (!where.id || c.id === where.id) && (!where.companyId || c.companyId === where.companyId)) || null;
      }),
      findMany: vi.fn(async ({ where, skip = 0, take = 20 }: any) => {
        return contacts
          .filter((c) => {
            if (where?.companyId && c.companyId !== where.companyId) return false;
            if (where?.type && c.type !== where.type) return false;
            if (where?.id?.in && !where.id.in.includes(c.id)) return false;
            return true;
          })
          .slice(skip, skip + take);
      }),
      count: vi.fn(async ({ where }: any) => {
        return contacts.filter((c) => !where?.companyId || c.companyId === where.companyId).length;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = contacts.findIndex((c) => c.id === where.id);
        if (idx >= 0) {
          contacts[idx] = { ...contacts[idx], ...data };
          return contacts[idx];
        }
        return null;
      })
    },
    taxRate: {
      create: vi.fn(async ({ data }: any) => {
        const t = { id: `tax-${Date.now()}-${Math.random()}`, ...data };
        taxRates.push(t);
        return t;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return taxRates.find((t) => (!where.id || t.id === where.id) && (!where.companyId || t.companyId === where.companyId)) || null;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return taxRates.filter((t) => !where?.companyId || t.companyId === where.companyId);
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = taxRates.findIndex((t) => t.id === where.id);
        if (idx >= 0) {
          taxRates[idx] = { ...taxRates[idx], ...data };
          return taxRates[idx];
        }
        return null;
      })
    },
    product: {
      create: vi.fn(async ({ data }: any) => {
        const p = { id: `prod-${Date.now()}-${Math.random()}`, ...data };
        products.push(p);
        return p;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          products.find(
            (p) =>
              (!where.id || p.id === where.id) &&
              (!where.companyId || p.companyId === where.companyId) &&
              (!where.sku || p.sku === where.sku) &&
              (!where.barcode || p.barcode === where.barcode) &&
              (where.isActive === undefined || p.isActive === where.isActive)
          ) || null
        );
      }),
      findMany: vi.fn(async ({ where, skip = 0, take = 20 }: any) => {
        return products
          .filter((p) => {
            if (where?.companyId && p.companyId !== where.companyId) return false;
            if (where?.categoryId && p.categoryId !== where.categoryId) return false;
            if (where?.isActive !== undefined && p.isActive !== where.isActive) return false;
            if (where?.id?.in && !where.id.in.includes(p.id)) return false;
            return true;
          })
          .slice(skip, skip + take);
      }),
      count: vi.fn(async ({ where }: any) => {
        return products.filter((p) => !where?.companyId || p.companyId === where.companyId).length;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = products.findIndex((p) => p.id === where.id);
        if (idx >= 0) {
          products[idx] = { ...products[idx], ...data };
          return products[idx];
        }
        return null;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = products.findIndex((p) => p.id === where.id);
        if (idx >= 0) {
          return products.splice(idx, 1)[0];
        }
        return null;
      })
    },
    stockMovement: {
      create: vi.fn(async ({ data }: any) => {
        const m = { id: `mv-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...data };
        stockMovements.push(m);
        return m;
      }),
      findMany: vi.fn(async ({ where, orderBy }: any) => {
        return stockMovements.filter((m) => {
          if (where?.companyId && m.companyId !== where.companyId) return false;
          if (where?.productId && m.productId !== where.productId) return false;
          if (where?.warehouseId && m.warehouseId !== where.warehouseId) return false;
          if (where?.sourceType && m.sourceType !== where.sourceType) return false;
          if (where?.sourceId && m.sourceId !== where.sourceId) return false;
          return true;
        });
      }),
      count: vi.fn(async ({ where }: any) => {
        return stockMovements.filter((m) => {
          if (where?.companyId && m.companyId !== where.companyId) return false;
          if (where?.productId && m.productId !== where.productId) return false;
          if (where?.warehouseId && m.warehouseId !== where.warehouseId) return false;
          return true;
        }).length;
      })
    },
    invoice: {
      create: vi.fn(async ({ data }: any) => {
        const id = `inv-${Date.now()}-${Math.random()}`;
        const inv = {
          id,
          companyId: data.companyId,
          number: data.number,
          contactId: data.contactId,
          date: data.date,
          dueDate: data.dueDate,
          status: data.status || "DRAFT",
          subtotal: data.subtotal,
          taxTotal: data.taxTotal,
          total: data.total,
          paidAmount: data.paidAmount || "0.00",
          notes: data.notes
        };
        invoices.push(inv);

        if (data.items?.create) {
          for (const item of data.items.create) {
            invoiceItems.push({
              id: `inv-item-${Date.now()}-${Math.random()}`,
              invoiceId: id,
              ...item
            });
          }
        }

        return {
          ...inv,
          items: invoiceItems.filter((it) => it.invoiceId === id)
        };
      }),
      findFirst: vi.fn(async ({ where, include }: any) => {
        const inv = invoices.find((i) => (!where.id || i.id === where.id) && (!where.companyId || i.companyId === where.companyId));
        if (!inv) return null;
        return {
          ...inv,
          items: include?.items ? invoiceItems.filter((it) => it.invoiceId === inv.id) : []
        };
      }),
      findMany: vi.fn(async ({ where, skip = 0, take, include }: any) => {
        const filtered = invoices
          .filter((i) => {
            if (where?.companyId && i.companyId !== where.companyId) return false;
            if (where?.contactId && i.contactId !== where.contactId) return false;
            if (where?.status) {
              if (typeof where.status === "string" && i.status !== where.status) return false;
              if (where.status.in && !where.status.in.includes(i.status)) return false;
              if (where.status.notIn && where.status.notIn.includes(i.status)) return false;
            }
            if (where?.date) {
              const d = new Date(i.date);
              if (where.date.gte && !(d >= new Date(where.date.gte))) return false;
              if (where.date.lte && !(d <= new Date(where.date.lte))) return false;
            }
            return true;
          });
        const sliced = take !== undefined ? filtered.slice(skip, skip + take) : filtered.slice(skip);
        return sliced.map((i) => ({
          ...i,
          items: include?.items ? invoiceItems.filter((it) => it.invoiceId === i.id) : []
        }));
      }),
      count: vi.fn(async ({ where }: any) => {
        return invoices.filter((i) => !where?.companyId || i.companyId === where.companyId).length;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = invoices.findIndex((i) => i.id === where.id);
        if (idx >= 0) {
          invoices[idx] = { ...invoices[idx], ...data };
          return invoices[idx];
        }
        return null;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = invoices.findIndex((i) => i.id === where.id);
        if (idx >= 0) {
          return invoices.splice(idx, 1)[0];
        }
        return null;
      })
    },
    invoiceItem: {
      deleteMany: vi.fn(async ({ where }: any) => {
        let count = 0;
        for (let i = invoiceItems.length - 1; i >= 0; i--) {
          if (invoiceItems[i].invoiceId === where.invoiceId) {
            invoiceItems.splice(i, 1);
            count++;
          }
        }
        return { count };
      })
    },
    bill: {
      create: vi.fn(async ({ data }: any) => {
        const id = `bill-${Date.now()}-${Math.random()}`;
        const b = {
          id,
          companyId: data.companyId,
          number: data.number,
          vendorBillNo: data.vendorBillNo,
          contactId: data.contactId,
          date: data.date,
          dueDate: data.dueDate,
          status: data.status || "DRAFT",
          subtotal: data.subtotal,
          taxTotal: data.taxTotal,
          total: data.total,
          paidAmount: data.paidAmount || "0.00"
        };
        bills.push(b);

        if (data.items?.create) {
          for (const item of data.items.create) {
            billItems.push({
              id: `bill-item-${Date.now()}-${Math.random()}`,
              billId: id,
              ...item
            });
          }
        }

        return {
          ...b,
          items: billItems.filter((it) => it.billId === id)
        };
      }),
      findFirst: vi.fn(async ({ where, include }: any) => {
        const b = bills.find((x) => (!where.id || x.id === where.id) && (!where.companyId || x.companyId === where.companyId));
        if (!b) return null;
        return {
          ...b,
          items: include?.items ? billItems.filter((it) => it.billId === b.id) : []
        };
      }),
      findMany: vi.fn(async ({ where, skip = 0, take, include }: any) => {
        const filtered = bills
          .filter((x) => {
            if (where?.companyId && x.companyId !== where.companyId) return false;
            if (where?.contactId && x.contactId !== where.contactId) return false;
            if (where?.status) {
              if (typeof where.status === "string" && x.status !== where.status) return false;
              if (where.status.in && !where.status.in.includes(x.status)) return false;
              if (where.status.notIn && where.status.notIn.includes(x.status)) return false;
            }
            if (where?.date) {
              const d = new Date(x.date);
              if (where.date.gte && !(d >= new Date(where.date.gte))) return false;
              if (where.date.lte && !(d <= new Date(where.date.lte))) return false;
            }
            return true;
          });
        const sliced = take !== undefined ? filtered.slice(skip, skip + take) : filtered.slice(skip);
        return sliced.map((b) => ({
          ...b,
          items: include?.items ? billItems.filter((it) => it.billId === b.id) : []
        }));
      }),
      count: vi.fn(async ({ where }: any) => {
        return bills.filter((b) => !where?.companyId || b.companyId === where.companyId).length;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = bills.findIndex((b) => b.id === where.id);
        if (idx >= 0) {
          bills[idx] = { ...bills[idx], ...data };
          return bills[idx];
        }
        return null;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = bills.findIndex((b) => b.id === where.id);
        if (idx >= 0) {
          return bills.splice(idx, 1)[0];
        }
        return null;
      })
    },
    billItem: {
      deleteMany: vi.fn(async ({ where }: any) => {
        let count = 0;
        for (let i = billItems.length - 1; i >= 0; i--) {
          if (billItems[i].billId === where.billId) {
            billItems.splice(i, 1);
            count++;
          }
        }
        return { count };
      })
    },
    payment: {
      create: vi.fn(async ({ data }: any) => {
        const p = { id: `pay-${Date.now()}-${Math.random()}`, ...data };
        payments.push(p);
        return p;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return payments.find((p) => (!where.id || p.id === where.id) && (!where.companyId || p.companyId === where.companyId)) || null;
      }),
      findMany: vi.fn(async ({ where, skip = 0, take = 20 }: any) => {
        return payments
          .filter((p) => {
            if (where?.companyId && p.companyId !== where.companyId) return false;
            if (where?.type && p.type !== where.type) return false;
            if (where?.contactId && p.contactId !== where.contactId) return false;
            if (where?.invoiceId && p.invoiceId !== where.invoiceId) return false;
            if (where?.billId && p.billId !== where.billId) return false;
            return true;
          })
          .slice(skip, skip + take);
      }),
      count: vi.fn(async ({ where }: any) => {
        return payments.filter((p) => !where?.companyId || p.companyId === where.companyId).length;
      })
    },
    creditNote: {
      create: vi.fn(async ({ data }: any) => {
        const id = `cn-${Date.now()}-${Math.random()}`;
        const cn = {
          id,
          companyId: data.companyId,
          number: data.number,
          invoiceId: data.invoiceId,
          contactId: data.contactId,
          date: data.date,
          status: data.status,
          subtotal: data.subtotal,
          taxTotal: data.taxTotal,
          total: data.total,
          notes: data.notes
        };
        creditNotes.push(cn);

        if (data.items?.create) {
          for (const item of data.items.create) {
            creditNoteItems.push({
              id: `cn-item-${Date.now()}-${Math.random()}`,
              creditNoteId: id,
              ...item
            });
          }
        }

        return {
          ...cn,
          items: creditNoteItems.filter((it) => it.creditNoteId === id)
        };
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return creditNotes.find((cn) => (!where.id || cn.id === where.id) && (!where.companyId || cn.companyId === where.companyId)) || null;
      })
    },
    bankAccount: {
      create: vi.fn(async ({ data }: any) => {
        const ba = { id: `ba-${Date.now()}-${Math.random()}`, ...data };
        bankAccounts.push(ba);
        return ba;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          bankAccounts.find((ba) => {
            if (where?.id && ba.id !== where.id) return false;
            if (where?.companyId && ba.companyId !== where.companyId) return false;
            return true;
          }) || null
        );
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return bankAccounts.filter((ba) => !where?.companyId || ba.companyId === where.companyId);
      })
    },
    bankStatement: {
      create: vi.fn(async ({ data }: any) => {
        const stmtId = `stmt-${Date.now()}-${Math.random()}`;
        const stmt = {
          id: stmtId,
          companyId: data.companyId,
          bankAccountId: data.bankAccountId,
          fileName: data.fileName,
          uploadedAt: new Date(),
          startDate: data.startDate,
          endDate: data.endDate,
          openingBalance: data.openingBalance,
          closingBalance: data.closingBalance
        };
        bankStatements.push(stmt);

        if (data.lines?.create) {
          for (const line of data.lines.create) {
            bankStatementLines.push({
              id: `stmt-line-${Date.now()}-${Math.random()}`,
              statementId: stmtId,
              ...line
            });
          }
        }

        return {
          ...stmt,
          lines: bankStatementLines.filter((l) => l.statementId === stmtId)
        };
      }),
      findFirst: vi.fn(async ({ where, include }: any) => {
        const found = bankStatements.find((s) => {
          if (where?.id && s.id !== where.id) return false;
          if (where?.companyId && s.companyId !== where.companyId) return false;
          if (where?.bankAccountId && s.bankAccountId !== where.bankAccountId) return false;
          return true;
        });
        if (!found) return null;

        const res: any = { ...found };
        if (include?.lines) {
          res.lines = bankStatementLines.filter((l) => l.statementId === found.id);
        }
        if (include?.bankAccount) {
          res.bankAccount = bankAccounts.find((ba) => ba.id === found.bankAccountId);
        }
        return res;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return bankStatements.filter((s) => !where?.companyId || s.companyId === where.companyId);
      })
    },
    bankStatementLine: {
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          bankStatementLines.find((l) => {
            if (where?.id && l.id !== where.id) return false;
            if (where?.companyId && l.companyId !== where.companyId) return false;
            return true;
          }) || null
        );
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return bankStatementLines.filter((l) => {
          if (where?.companyId && l.companyId !== where.companyId) return false;
          if (where?.statementId && l.statementId !== where.statementId) return false;
          return true;
        });
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = bankStatementLines.findIndex((l) => l.id === where.id);
        if (idx >= 0) {
          bankStatementLines[idx] = { ...bankStatementLines[idx], ...data };
          return bankStatementLines[idx];
        }
        return null;
      })
    },
    auditLog: {
      create: vi.fn(async ({ data }: any) => {
        const log = { id: `log-${Date.now()}-${Math.random()}`, timestamp: new Date(), ...data };
        auditLogs.push(log);
        return log;
      }),
      findMany: vi.fn(async ({ where, skip = 0, take = 50 }: any) => {
        return auditLogs
          .filter((l) => {
            if (where?.companyId && l.companyId !== where.companyId) return false;
            if (where?.userId && l.userId !== where.userId) return false;
            if (where?.model && l.model !== where.model) return false;
            if (where?.action && l.action !== where.action) return false;
            if (where?.timestamp?.gte && new Date(l.timestamp).getTime() < new Date(where.timestamp.gte).getTime()) return false;
            if (where?.timestamp?.lte && new Date(l.timestamp).getTime() > new Date(where.timestamp.lte).getTime()) return false;
            return true;
          })
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(skip, skip + take);
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          auditLogs.find((l) => {
            if (where?.id && l.id !== where.id) return false;
            if (where?.companyId && l.companyId !== where.companyId) return false;
            return true;
          }) || null
        );
      }),
      count: vi.fn(async ({ where }: any) => {
        return auditLogs.filter((l) => {
          if (where?.companyId && l.companyId !== where.companyId) return false;
          if (where?.userId && l.userId !== where.userId) return false;
          if (where?.model && l.model !== where.model) return false;
          if (where?.action && l.action !== where.action) return false;
          return true;
        }).length;
      }),
      update: vi.fn(async () => {
        throw new Error("AuditLog records are immutable. UPDATE is forbidden.");
      }),
      delete: vi.fn(async () => {
        throw new Error("AuditLog records are immutable. DELETE is forbidden.");
      })
    },
    currencyRate: {
      create: vi.fn(async ({ data }: any) => {
        const cr = { id: `cr-${Date.now()}-${Math.random()}`, date: new Date(), ...data };
        currencyRates.push(cr);
        return cr;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          currencyRates.find(
            (cr) =>
              (!where.companyId || cr.companyId === where.companyId) &&
              (!where.fromCode || cr.fromCode === where.fromCode) &&
              (!where.toCode || cr.toCode === where.toCode)
          ) || null
        );
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return currencyRates.filter((cr) => !where?.companyId || cr.companyId === where.companyId);
      })
    },
    recurringInvoice: {
      create: vi.fn(async ({ data }: any) => {
        const ri = { id: `rec-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...data };
        recurringInvoices.push(ri);
        return ri;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          recurringInvoices.find(
            (ri) =>
              (!where.id || ri.id === where.id) &&
              (!where.companyId || ri.companyId === where.companyId) &&
              (where.isActive === undefined || ri.isActive === where.isActive)
          ) || null
        );
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return recurringInvoices.filter((ri) => {
          if (where?.companyId && ri.companyId !== where.companyId) return false;
          if (where?.isActive !== undefined && ri.isActive !== where.isActive) return false;
          if (where?.nextRunDate?.lte && new Date(ri.nextRunDate).getTime() > new Date(where.nextRunDate.lte).getTime()) return false;
          return true;
        });
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = recurringInvoices.findIndex((ri) => ri.id === where.id);
        if (idx >= 0) {
          recurringInvoices[idx] = { ...recurringInvoices[idx], ...data };
          return recurringInvoices[idx];
        }
        return null;
      })
    },
    emailLog: {
      create: vi.fn(async ({ data }: any) => {
        const el = { id: `email-${Date.now()}-${Math.random()}`, sentAt: new Date(), ...data };
        emailLogs.push(el);
        return el;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return emailLogs.filter((el) => !where?.companyId || el.companyId === where.companyId);
      })
    },
    $transaction: vi.fn(async (callback: any) => {
      if (typeof callback === "function") {
        return callback(db);
      }
      return Promise.all(callback);
    })
  };

  return {
    db,
    stores: {
      users,
      companies,
      memberships,
      accounts,
      warehouses,
      sequences,
      fiscalYears,
      journalEntries,
      journalLines,
      auditLogs,
      categories,
      contacts,
      taxRates,
      products,
      stockMovements,
      invoices,
      invoiceItems,
      bills,
      billItems,
      payments,
      creditNotes,
      creditNoteItems,
      bankAccounts,
      bankStatements,
      bankStatementLines,
      currencyRates,
      recurringInvoices,
      emailLogs
    }
  };
}
