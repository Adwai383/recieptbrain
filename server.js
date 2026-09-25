const fs =
  require('node:fs');

const path =
  require('node:path');

const http =
  require('node:http');

const {
  URL
} =
  require('node:url');


const {
  parseReceipt
} =
  require('./parser');


const {
  databasePath,
  saveReceipt,
  getReceipt,
  getAllReceipts,
  getAnalytics,
  closeDatabase
} =
  require('./db');


const {
  recognizeImage
} =
  require('./ocr');


const {
  generateInsight,
  hasAIConfig
} =
  require('./ai');


const rootDirectory =
  path.join(
    __dirname,
    '..'
  );


const frontendDirectory =
  path.join(
    rootDirectory,
    'frontend'
  );


const configPath =
  path.join(
    rootDirectory,
    'config.json'
  );


function loadConfig() {

  const defaults = {

    port: 3000,

    maxImageMB: 15,

    maxBodyMB: 30,

    ocrLanguage: 'eng',

    ocrPsm: 6,

    tesseractPath: '',

    openaiApiKey: '',

    openaiModel: ''

  };


  if (
    !fs.existsSync(
      configPath
    )
  ) {

    return defaults;

  }


  try {

    const userConfig =
      JSON.parse(

        fs.readFileSync(
          configPath,
          'utf8'
        )

      );


    return {

      ...defaults,

      ...userConfig

    };

  } catch (error) {

    throw new Error(

      `config.json is invalid: ${error.message}`

    );

  }

}


const config =
  loadConfig();


const PORT =
  Number(
    config.port
  ) || 3000;


const MAX_BODY_BYTES =
  Math.max(

    1,

    Number(
      config.maxBodyMB
    ) || 30

  ) *
  1024 *
  1024;


const allowedStaticFiles = {

  '/':
    [
      'index.html',
      'text/html; charset=utf-8'
    ],

  '/index.html':
    [
      'index.html',
      'text/html; charset=utf-8'
    ],

  '/style.css':
    [
      'style.css',
      'text/css; charset=utf-8'
    ],

  '/script.js':
    [
      'script.js',
      'application/javascript; charset=utf-8'
    ]

};


function sendJson(
  res,
  statusCode,
  payload
) {

  const body =
    JSON.stringify(
      payload
    );


  res.writeHead(

    statusCode,

    {

      'Content-Type':
        'application/json; charset=utf-8',

      'Content-Length':
        Buffer.byteLength(
          body
        ),

      'Cache-Control':
        'no-store'

    }

  );


  res.end(
    body
  );

}


function sendText(
  res,
  statusCode,
  text,
  contentType =
    'text/plain; charset=utf-8'
) {

  res.writeHead(

    statusCode,

    {

      'Content-Type':
        contentType,

      'Content-Length':
        Buffer.byteLength(
          text
        )

    }

  );


  res.end(
    text
  );

}


function readRequestBody(
  req,
  maxBytes
) {

  return new Promise(
    (resolve, reject) => {

      let size = 0;

      const chunks = [];


      req.on(
        'data',
        (chunk) => {

          size +=
            chunk.length;


          if (
            size > maxBytes
          ) {

            reject(

              new Error(

                `Request is too large. Maximum body size is ${Math.round(
                  maxBytes / 1024 / 1024
                )} MB.`

              )

            );


            req.destroy();

            return;

          }


          chunks.push(
            chunk
          );

        }
      );


      req.on(
        'end',
        () => {

          resolve(
            Buffer.concat(
              chunks
            )
          );

        }
      );


      req.on(
        'error',
        reject
      );

    }
  );

}


async function readJsonBody(
  req
) {

  const buffer =
    await readRequestBody(
      req,
      MAX_BODY_BYTES
    );


  if (
    !buffer.length
  ) {

    return {};

  }


  try {

    return JSON.parse(
      buffer.toString(
        'utf8'
      )
    );

  } catch {

    throw new Error(
      'Request body must contain valid JSON.'
    );

  }

}


function sanitizeReceipt(
  receipt,
  source
) {

  const items =
    Array.isArray(
      receipt.items
    )

      ? receipt.items

          .filter(
            (item) =>
              item &&
              String(
                item.name ||
                ''
              ).trim()
          )

          .map(
            (item) => ({

              name:
                String(
                  item.name
                )
                .trim()
                .slice(
                  0,
                  200
                ),

              price:
                Math.max(
                  0,
                  Number(
                    item.price
                  ) || 0
                ),

              quantity:
                Math.max(
                  1,
                  Number.parseInt(
                    item.quantity,
                    10
                  ) || 1
                ),

              category:
                String(
                  item.category ||
                  'Other'
                )
                .trim()
                .slice(
                  0,
                  50
                ) ||
                'Other'

            })
          )

      : [];


  return {

    storeName:
      String(
        receipt.storeName ||
        'Unknown Store'
      )
      .trim()
      .slice(
        0,
        200
      ) ||
      'Unknown Store',


    date:
      /^\d{4}-\d{2}-\d{2}$/
        .test(
          String(
            receipt.date
          )
        )

        ? String(
            receipt.date
          )

        : new Date()
            .toISOString()
            .slice(
              0,
              10
            ),


    total:
      Math.max(
        0,
        Number(
          receipt.total
        ) || 0
      ),


    rawText:
      String(
        receipt.rawText ||
        ''
      )
      .slice(
        0,
        200000
      ),


    source,

    items

  };

}


function saveParsedReceipt(
  parsed,
  source
) {

  const safeReceipt =
    sanitizeReceipt(
      parsed,
      source
    );


  const id =
    saveReceipt(
      safeReceipt
    );


  return getReceipt(
    id
  );

}


function serveStatic(
  pathname,
  res
) {

  const entry =
    allowedStaticFiles[
      pathname
    ];


  if (!entry) {

    sendText(
      res,
      404,
      'Not found'
    );

    return;

  }


  const filePath =
    path.join(
      frontendDirectory,
      entry[0]
    );


  if (
    !fs.existsSync(
      filePath
    )
  ) {

    sendText(

      res,

      500,

      `Missing frontend file: ${entry[0]}`

    );

    return;

  }


  const data =
    fs.readFileSync(
      filePath
    );


  res.writeHead(

    200,

    {

      'Content-Type':
        entry[1],

      'Content-Length':
        data.length,

      'Cache-Control':
        pathname === '/index.html' ||
        pathname === '/'
          ? 'no-cache'
          : 'public, max-age=60'

    }

  );


  res.end(
    data
  );

}


async function handleRequest(
  req,
  res
) {

  const url =
    new URL(

      req.url,

      `http://${
        req.headers.host ||
        'localhost'
      }`

    );


  const pathname =
    url.pathname;


  if (

    req.method === 'GET' &&

    allowedStaticFiles[
      pathname
    ]

  ) {

    serveStatic(
      pathname,
      res
    );

    return;

  }


  if (

    req.method === 'GET' &&

    pathname ===
      '/api/status'

  ) {

    sendJson(

      res,

      200,

      {

        status:
          'online',

        app:
          'ReceiptBrain',

        backend:
          'Node.js built-ins',

        ocr:
          'Tesseract CLI',

        database:
          'SQLite via node:sqlite',

        aiConfigured:
          hasAIConfig(
            config
          ),

        port:
          PORT

      }

    );

    return;

  }


  if (

    req.method === 'POST' &&

    pathname ===
      '/api/receipt/text'

  ) {

    const body =
      await readJsonBody(
        req
      );


    const text =
      String(
        body?.text ||
        ''
      ).trim();


    if (!text) {

      sendJson(

        res,

        400,

        {

          error:
            'Receipt text is empty.'

        }

      );

      return;

    }


    const parsed =
      parseReceipt(
        text
      );


    const receipt =
      saveParsedReceipt(
        parsed,
        'text'
      );


    sendJson(

      res,

      201,

      {

        success:
          true,

        receipt,

        message:
          'Receipt text processed and saved.'

      }

    );

    return;

  }


  if (

    req.method === 'POST' &&

    pathname ===
      '/api/receipt/image'

  ) {

    const body =
      await readJsonBody(
        req
      );


    const base64 =
      String(
        body?.data ||
        ''
      ).trim();


    const filename =
      String(
        body?.filename ||
        'receipt.jpg'
      );


    const mimeType =
      String(
        body?.mimeType ||
        'image/jpeg'
      );


    if (!base64) {

      sendJson(

        res,

        400,

        {

          error:
            'No receipt image was uploaded.'

        }

      );

      return;

    }


    if (
      !mimeType.startsWith(
        'image/'
      )
    ) {

      sendJson(

        res,

        400,

        {

          error:
            'Only image files are supported.'

        }

      );

      return;

    }


    const imageBuffer =
      Buffer.from(
        base64,
        'base64'
      );


    const maxImageBytes =
      Math.max(

        1,

        Number(
          config.maxImageMB
        ) || 15

      ) *
      1024 *
      1024;


    if (
      imageBuffer.length >
      maxImageBytes
    ) {

      sendJson(

        res,

        413,

        {

          error:
            `Image is too large. Maximum image size is ${
              Number(
                config.maxImageMB
              ) || 15
            } MB.`

        }

      );

      return;

    }


    const rawText =
      await recognizeImage(

        imageBuffer,

        filename,

        mimeType,

        config

      );


    if (!rawText) {

      sendJson(

        res,

        422,

        {

          error:
            'OCR could not find readable text in the image.'

        }

      );

      return;

    }


    const parsed =
      parseReceipt(
        rawText
      );


    const receipt =
      saveParsedReceipt(
        parsed,
        'image'
      );


    sendJson(

      res,

      201,

      {

        success:
          true,

        receipt,

        message:
          'Receipt image processed and saved.'

      }

    );

    return;

  }


  if (

    req.method === 'GET' &&

    pathname ===
      '/api/receipts'

  ) {

    sendJson(

      res,

      200,

      {

        success:
          true,

        receipts:
          getAllReceipts(
            url.searchParams.get(
              'limit'
            ) || 30
          )

      }

    );

    return;

  }


  const receiptMatch =
    pathname.match(
      /^\/api\/receipts\/(\d+)$/
    );


  if (

    req.method === 'GET' &&

    receiptMatch

  ) {

    const id =
      Number.parseInt(
        receiptMatch[1],
        10
      );


    const receipt =
      getReceipt(
        id
      );


    if (!receipt) {

      sendJson(

        res,

        404,

        {

          error:
            'Receipt not found.'

        }

      );

      return;

    }


    sendJson(

      res,

      200,

      {

        success:
          true,

        receipt

      }

    );

    return;

  }


  if (

    req.method === 'GET' &&

    pathname ===
      '/api/analytics'

  ) {

    sendJson(

      res,

      200,

      {

        success:
          true,

        analytics:
          getAnalytics()

      }

    );

    return;

  }


  if (

    req.method === 'POST' &&

    pathname ===
      '/api/ai/insight'

  ) {

    const analytics =
      getAnalytics();


    const insight =
      await generateInsight(

        analytics,

        config

      );


    sendJson(

      res,

      200,

      {

        success:
          true,

        ...insight,

        analytics

      }

    );

    return;

  }


  if (

    req.method === 'GET' &&

    !pathname.startsWith(
      '/api/'
    )

  ) {

    serveStatic(
      '/',
      res
    );

    return;

  }


  sendJson(

    res,

    404,

    {

      error:
        'Route not found.'

    }

  );

}


const server =
  http.createServer(

    async (
      req,
      res
    ) => {

      try {

        await handleRequest(
          req,
          res
        );

      } catch (error) {

        console.error(
          error
        );


        const message =
          error?.message ||
          'Something went wrong on the server.';


        const status =
          /too large/i.test(
            message
          )
            ? 413
            : 500;


        sendJson(

          res,

          status,

          {

            error:
              message

          }

        );

      }

    }

  );


server.listen(

  PORT,

  '127.0.0.1',

  () => {

    console.log('');

    console.log(
      '=============================='
    );

    console.log(
      '        RECEIPTBRAIN'
    );

    console.log(
      '=============================='
    );

    console.log(
      `Open: http://127.0.0.1:${PORT}`
    );

    console.log(
      `Database: ${databasePath}`
    );

    console.log(

      `OCR: ${
        config.tesseractPath ||
        process.env.TESSERACT_PATH ||
        'tesseract'
      }`

    );

    console.log(

      `AI: ${
        hasAIConfig(config)
          ? 'configured'
          : 'local fallback'
      }`

    );

    console.log(
      '=============================='
    );

    console.log('');

  }

);


function shutdown(
  signal
) {

  console.log(
    `\n${signal} received. Shutting down...`
  );


  server.close(
    () => {

      try {

        closeDatabase();

      } finally {

        process.exit(
          0
        );

      }

    }
  );

}


process.on(
  'SIGINT',
  () =>
    shutdown(
      'SIGINT'
    )
);


process.on(
  'SIGTERM',
  () =>
    shutdown(
      'SIGTERM'
    )
);