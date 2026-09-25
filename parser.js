const CATEGORIES = {

  Food: [
    'restaurant',
    'food',
    'pizza',
    'burger',
    'sandwich',
    'meal',
    'snack',
    'juice',
    'coffee',
    'tea',
    'cake',
    'biryani',
    'dosa',
    'idli',
    'chicken',
    'fish',
    'meat',
    'bakery',
    'cafe'
  ],

  Groceries: [
    'milk',
    'bread',
    'rice',
    'wheat',
    'flour',
    'atta',
    'sugar',
    'salt',
    'egg',
    'eggs',
    'vegetable',
    'vegetables',
    'fruit',
    'fruits',
    'oil',
    'dal',
    'lentil',
    'soap',
    'detergent',
    'shampoo',
    'toothpaste',
    'grocery'
  ],

  Transport: [
    'petrol',
    'diesel',
    'fuel',
    'uber',
    'ola',
    'taxi',
    'bus',
    'metro',
    'train',
    'ticket',
    'parking',
    'toll',
    'transport'
  ],

  Shopping: [
    'shirt',
    'tshirt',
    'jeans',
    'shoe',
    'shoes',
    'dress',
    'clothes',
    'bag',
    'watch',
    'electronics',
    'phone',
    'headphone',
    'accessory',
    'shopping'
  ],

  Bills: [
    'electricity',
    'water bill',
    'internet',
    'wifi',
    'mobile',
    'recharge',
    'rent',
    'insurance',
    'bill'
  ],

  Health: [
    'medicine',
    'tablet',
    'capsule',
    'pharmacy',
    'doctor',
    'hospital',
    'health',
    'medical'
  ]

};


function cleanText(text) {

  return String(text || '')

    .replace(
      /\r\n/g,
      '\n'
    )

    .replace(
      /\r/g,
      '\n'
    )

    .replace(
      /[ \t]{2,}/g,
      ' '
    )

    .split('\n')

    .map(
      (line) =>
        line.trim()
    )

    .filter(Boolean)

    .join('\n');

}


function normalizeNumber(value) {

  const cleaned =
    String(value ?? '')

      .replace(
        /[₹$€£]/g,
        ''
      )

      .replace(
        /\s/g,
        ''
      )

      .replace(
        /,/g,
        ''
      );


  const number =
    Number(cleaned);


  return Number.isFinite(
    number
  )
    ? number
    : 0;

}


function categoryForItem(name) {

  const value =
    String(name || '')
      .toLowerCase();


  for (
    const [
      category,
      keywords
    ]
    of Object.entries(
      CATEGORIES
    )
  ) {

    if (
      keywords.some(
        (keyword) =>
          value.includes(
            keyword
          )
      )
    ) {

      return category;

    }

  }


  return 'Other';

}


function extractTotal(lines) {

  const labels = [

    'grand total',
    'net total',
    'amount payable',
    'amount due',
    'balance due',
    'total'

  ];


  for (
    let index =
      lines.length - 1;

    index >= 0;

    index -= 1
  ) {

    const line =
      lines[index];


    if (
      !labels.some(
        (label) =>
          line
            .toLowerCase()
            .includes(label)
      )
    ) {

      continue;

    }


    const matches =
      line.match(
        /(?:₹|rs\.?|inr)?\s*([\d]+(?:,[\d]{2,3})*|\d+)(?:\.(\d{1,2}))?/gi
      ) || [];


    if (!matches.length) {
      continue;
    }


    const last =
      matches[
        matches.length - 1
      ];


    const amount =
      last.match(
        /[\d,]+(?:\.\d{1,2})?/
      );


    if (amount) {

      return normalizeNumber(
        amount[0]
      );

    }

  }


  return 0;

}


function extractStoreName(lines) {

  const ignored =
    /^(receipt|invoice|bill|tax invoice|cash memo|date|time|total|subtotal|gst|vat|thank|phone|tel|www\.)/i;


  for (
    const line
    of lines.slice(0, 8)
  ) {

    if (
      line.length < 2
    ) {

      continue;

    }


    if (
      ignored.test(line)
    ) {

      continue;

    }


    if (
      !/[a-zA-Z]/.test(line)
    ) {

      continue;

    }


    if (
      /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/
        .test(line)
    ) {

      continue;

    }


    return line.slice(
      0,
      120
    );

  }


  return 'Unknown Store';

}


function extractDate(text) {

  const patterns = [

    /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/,

    /(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/

  ];


  for (
    const pattern
    of patterns
  ) {

    const match =
      String(text).match(
        pattern
      );


    if (!match) {
      continue;
    }


    let year;
    let month;
    let day;


    if (
      match[1].length === 4
    ) {

      year =
        Number(match[1]);

      month =
        Number(match[2]);

      day =
        Number(match[3]);

    } else {

      day =
        Number(match[1]);

      month =
        Number(match[2]);

      year =
        Number(match[3]);

    }


    if (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {

      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    }

  }


  return new Date()
    .toISOString()
    .slice(
      0,
      10
    );

}


function looksLikeNonItem(line) {

  return (

    /^(total|subtotal|grand total|net total|amount|change|balance|cash|card|upi|visa|mastercard|gst|cgst|sgst|igst|tax|discount|date|time|invoice|receipt|thank|www\.)\b/i
      .test(line)

    ||

    /^(phone|tel|mobile)\b/i
      .test(line)

    ||

    /\b(?:gstin|invoice no|bill no|order id)\b/i
      .test(line)

  );

}


function parseItemLine(line) {

  const compact =
    String(line).trim();


  if (
    compact.length < 2 ||
    looksLikeNonItem(compact)
  ) {

    return null;

  }


  const pricePattern =
    /(?:₹|rs\.?|inr)?\s*([\d]{1,3}(?:,[\d]{2,3})+|\d+)(?:\.(\d{1,2}))?\s*$/i;


  const match =
    compact.match(
      pricePattern
    );


  if (!match) {
    return null;
  }


  const price =
    normalizeNumber(
      `${match[1]}${
        match[2]
          ? `.${match[2]}`
          : ''
      }`
    );


  if (
    price <= 0
  ) {

    return null;

  }


  let name =
    compact
      .slice(
        0,
        match.index
      )
      .trim();


  if (
    !name ||
    !/[a-zA-Z]/.test(name)
  ) {

    return null;

  }


  let quantity = 1;


  let qtyMatch =
    name.match(
      /^(\d+)\s*[xX*]?\s+(.+)$/
    );


  if (qtyMatch) {

    quantity =
      Math.max(
        1,
        Number(qtyMatch[1])
      );

    name =
      qtyMatch[2].trim();

  } else {

    qtyMatch =
      name.match(
        /^(.+?)\s*[xX*]\s*(\d+)$/
      );


    if (qtyMatch) {

      name =
        qtyMatch[1].trim();


      quantity =
        Math.max(
          1,
          Number(qtyMatch[2])
        );

    }

  }


  name =
    name

      .replace(
        /^\d{1,2}[.)]\s+/,
        ''
      )

      .replace(
        /^[|:_-]+|[|:_-]+$/g,
        ''
      )

      .replace(
        /\s{2,}/g,
        ' '
      )

      .trim();


  if (
    name.length < 2
  ) {

    return null;

  }


  return {

    name,

    price,

    quantity,

    category:
      categoryForItem(
        name
      )

  };

}


function parseReceipt(rawText) {

  const cleanedText =
    cleanText(
      rawText
    );


  const lines =
    cleanedText.split(
      '\n'
    );


  const items = [];


  for (
    const line
    of lines
  ) {

    const item =
      parseItemLine(
        line
      );


    if (item) {

      items.push(item);

    }

  }


  const seen =
    new Set();


  const uniqueItems =
    items.filter(
      (item) => {

        const key =
          `${item.name.toLowerCase()}|${item.price}|${item.quantity}`;


        if (
          seen.has(key)
        ) {

          return false;

        }


        seen.add(key);

        return true;

      }
    );


  const itemSum =
    uniqueItems.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.price *
        item.quantity,

      0
    );


  const receiptTotal =
    extractTotal(
      lines
    );


  const total =
    receiptTotal > 0
      ? receiptTotal
      : itemSum;


  return {

    storeName:
      extractStoreName(
        lines
      ),

    date:
      extractDate(
        cleanedText
      ),

    total:
      Number(
        total.toFixed(2)
      ),

    rawText:
      cleanedText,

    items:
      uniqueItems

  };

}


module.exports = {

  parseReceipt,

  categoryForItem

};