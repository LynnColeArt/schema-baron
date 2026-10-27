import Database from 'better-sqlite3';
/** Independent money oracle: no compiler/runtime helpers and no SQLite floating arithmetic. */
export function exactBorrowerTotals(path: string) {
  const db = new Database(path, {
    readonly: true
  });
  try {
    const people = db.prepare('SELECT id,name FROM borrowers ORDER BY id').all() as {
      id: number;
      name: string;
    }[];
    const lines = db.prepare('SELECT l.borrower_id, x.quantity, x.unit_price FROM loans l JOIN loan_lines x ON x.loan_id=l.id ORDER BY x.id').all() as {
      borrower_id: number;
      quantity: number;
      unit_price: string;
    }[];
    function cents(value: string) {
      if (!/^-?\d+\.\d{2}$/.test(value)) throw new Error('Expected canonical two-place exact decimal');
      return BigInt(value.replace('.', ''));
    }
    return people.map(person => {
      const total = lines.filter(line => line.borrower_id === person.id).reduce((sum, line) => sum + BigInt(line.quantity) * cents(line.unit_price), 0n);
      return {
        id: person.id,
        name: person.name,
        total: `${total / 100n}.${(total % 100n).toString().padStart(2, '0')}`
      };
    });
  } finally {
    db.close();
  }
}
