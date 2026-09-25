const fs = require('node:fs');
const path = require('node:path');

const {
  DatabaseSync
} = require('node:sqlite');


const databaseDirectory =
  path.join(
    __dirname,
    '..',
    'database'
  );


fs.mkdirSync(
  databaseDirectory,
  {
    recursive: true
  }
);


const databasePath =
  path.join(
    databaseDirectory,
    'receiptbrain.db'
  );


const db =
  new DatabaseSync(
    databasePath
  );


db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS receipts (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    store_name TEXT NOT NULL
      DEFAULT 'Unknown Store',

    receipt_date TEXT NOT NULL,

    total REAL NOT NULL
      DEFAULT 0,

    raw_text TEXT NOT NULL
      DEFAULT '',

    source TEXT NOT NULL
      DEFAULT 'text',

    created_at TEXT NOT NULL
      DEFAULT CURRENT_TIMESTAMP

  );


  CREATE TABLE IF NOT EXISTS items (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    receipt_id INTEGER NOT NULL,

    item_name TEXT NOT NULL,

    price REAL NOT NULL
      DEFAULT 0,

    quantity INTEGER NOT NULL
      DEFAULT 1,

    category TEXT NOT NULL
      DEFAULT 'Other',

    FOREIGN KEY (receipt_id)
      REFERENCES receipts(id)

      ON DELETE CASCADE

  );


  CREATE INDEX IF NOT EXISTS
    idx_receipts_date

    ON receipts(receipt_date);


  CREATE INDEX IF NOT EXISTS
    idx_items_receipt

    ON items(receipt_id);


  CREATE INDEX IF NOT EXISTS
    idx_items_category

    ON items(category);

`);


const insertReceipt =
  db.prepare(`

    INSERT INTO receipts (

      store_name,
      receipt_date,
      total,
      raw_text,
      source

    )

    VALUES (?, ?, ?, ?, ?)

  `);


const insertItem =
  db.prepare(`

    INSERT INTO items (

      receipt_id,
      item_name,
      price,
      quantity,
      category

    )

    VALUES (?, ?, ?, ?, ?)

  `);


const getReceiptStatement =
  db.prepare(`

    SELECT

      id,

      store_name AS storeName,

      receipt_date AS date,

      total,

      raw_text AS rawText,

      source,

      created_at AS createdAt

    FROM receipts

    WHERE id = ?

  `);


const getItemsStatement =
  db.prepare(`

    SELECT

      id,

      item_name AS name,

      price,

      quantity,

      category

    FROM items

    WHERE receipt_id = ?

    ORDER BY id ASC

  `);


function saveReceipt(receipt) {

  db.exec(
    'BEGIN'
  );


  try {

    const result =
      insertReceipt.run(

        receipt.storeName,

        receipt.date,

        receipt.total,

        receipt.rawText,

        receipt.source

      );


    const receiptId =
      Number(
        result.lastInsertRowid
      );


    for (
      const item
      of receipt.items
    ) {

      insertItem.run(

        receiptId,

        item.name,

        item.price,

        item.quantity,

        item.category

      );

    }


    db.exec(
      'COMMIT'
    );


    return receiptId;

  } catch (error) {

    try {

      db.exec(
        'ROLLBACK'
      );

    } catch {

      // ignore rollback failure

    }


    throw error;

  }

}


function getReceipt(id) {

  const receipt =
    getReceiptStatement.get(
      id
    );


  if (!receipt) {

    return null;

  }


  receipt.items =
    getItemsStatement.all(
      id
    );


  return receipt;

}


function getAllReceipts(
  limit = 30
) {

  const safeLimit =
    Math.min(

      500,

      Math.max(

        1,

        Number.parseInt(
          limit,
          10
        ) || 30

      )

    );


  const receipts =
    db.prepare(`

      SELECT

        id,

        store_name AS storeName,

        receipt_date AS date,

        total,

        raw_text AS rawText,

        source,

        created_at AS createdAt

      FROM receipts

      ORDER BY
        receipt_date DESC,
        id DESC

      LIMIT ?

    `).all(
      safeLimit
    );


  for (
    const receipt
    of receipts
  ) {

    receipt.items =
      getItemsStatement.all(
        receipt.id
      );

  }


  return receipts;

}


function getAnalytics() {

  const now =
    new Date();


  const month =
    `${now.getFullYear()}-${
      String(
        now.getMonth() + 1
      ).padStart(
        2,
        '0'
      )}`;


  const nextMonthNumber =
    Number(
      month.slice(5, 7)
    ) + 1;


  let nextMonth;


  if (
    nextMonthNumber === 13
  ) {

    nextMonth =
      `${Number(month.slice(0, 4)) + 1}-01`;

  } else {

    nextMonth =
      `${month.slice(0, 4)}-${String(nextMonthNumber).padStart(2, '0')}`;

  }


  const monthStart =
    `${month}-01`;


  const nextMonthStart =
    `${nextMonth}-01`;


  const totals =
    db.prepare(`

      SELECT

        COALESCE(
          SUM(total),
          0
        ) AS monthlyTotal,

        COUNT(*) AS receiptCount

      FROM receipts

      WHERE receipt_date >= ?

      AND receipt_date < ?

    `).get(

      monthStart,

      nextMonthStart

    );


  const itemCount =
    db.prepare(`

      SELECT

        COALESCE(
          SUM(i.quantity),
          0
        ) AS itemCount

      FROM items i

      INNER JOIN receipts r

        ON r.id =
           i.receipt_id

      WHERE r.receipt_date >= ?

      AND r.receipt_date < ?

    `).get(

      monthStart,

      nextMonthStart

    );


  const categories =
    db.prepare(`

      SELECT

        category,

        ROUND(
          SUM(
            price * quantity
          ),
          2
        ) AS total

      FROM items i

      INNER JOIN receipts r

        ON r.id =
           i.receipt_id

      WHERE r.receipt_date >= ?

      AND r.receipt_date < ?

      GROUP BY category

      ORDER BY total DESC

    `).all(

      monthStart,

      nextMonthStart

    );


  const topItems =
    db.prepare(`

      SELECT

        item_name AS name,

        ROUND(
          SUM(
            price * quantity
          ),
          2
        ) AS total,

        SUM(quantity) AS quantity

      FROM items i

      INNER JOIN receipts r

        ON r.id =
           i.receipt_id

      WHERE r.receipt_date >= ?

      AND r.receipt_date < ?

      GROUP BY item_name

      ORDER BY total DESC

      LIMIT 10

    `).all(

      monthStart,

      nextMonthStart

    );


  return {

    month,

    monthlyTotal:
      Number(
        totals.monthlyTotal || 0
      ),

    receiptCount:
      Number(
        totals.receiptCount || 0
      ),

    itemCount:
      Number(
        itemCount.itemCount || 0
      ),

    categories:

      categories.map(
        (row) => ({

          category:
            row.category,

          total:
            Number(
              row.total || 0
            )

        })
      ),

    topItems:

      topItems.map(
        (row) => ({

          name:
            row.name,

          total:
            Number(
              row.total || 0
            ),

          quantity:
            Number(
              row.quantity || 0
            )

        })
      )

  };

}


function closeDatabase() {

  if (
    db.isOpen
  ) {

    db.close();

  }

}


module.exports = {

  databasePath,

  saveReceipt,

  getReceipt,

  getAllReceipts,

  getAnalytics,

  closeDatabase

};