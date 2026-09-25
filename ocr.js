const fs =
  require('fs');

const os =
  require('os');

const path =
  require('path');

const crypto =
  require('crypto');

const {
  execFile
} =
  require('child_process');

const {
  promisify
} =
  require('util');


const execFileAsync =
  promisify(
    execFile
  );


/* =====================================================
   TESSERACT LOCATION
===================================================== */

const configuredPath =
  process.env.TESSERACT_PATH;


const defaultWindowsPath =
  'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';


const tesseractPath =
  configuredPath ||

  (

    process.platform === 'win32'

      ? defaultWindowsPath

      : 'tesseract'

  );


/* =====================================================
   OCR
===================================================== */

async function recognizeImage(
  buffer
) {

  if (

    !Buffer.isBuffer(
      buffer
    )

    ||

    buffer.length === 0

  ) {

    throw new Error(
      'OCR received an empty image.'
    );

  }


  const temporaryDirectory =
    await fs.promises.mkdtemp(
      path.join(
        os.tmpdir(),
        'receiptbrain-'
      )
    );


  const inputPath =
    path.join(

      temporaryDirectory,

      `${crypto.randomUUID()}.png`

    );


  try {

    await fs.promises.writeFile(

      inputPath,

      buffer

    );


    /*
      Tesseract:

      input image
      stdout
      English
      PSM 6
    */

    const result =
      await execFileAsync(

        tesseractPath,

        [

          inputPath,

          'stdout',

          '-l',
          'eng',

          '--psm',
          '6'

        ],

        {

          windowsHide:
            true,

          maxBuffer:
            5 * 1024 * 1024

        }

      );


    return String(
      result.stdout ||
      ''
    ).trim();

  }

  catch (
    error
  ) {

    if (
      error.code ===
      'ENOENT'
    ) {

      throw new Error(

        `Tesseract was not found.

Install Tesseract OCR or set TESSERACT_PATH.

Current path:
${tesseractPath}`

      );

    }


    throw new Error(

      `OCR failed:
${error.stderr || error.message}`

    );

  }

  finally {

    await fs.promises.rm(

      temporaryDirectory,

      {

        recursive:
          true,

        force:
          true

      }

    );

  }

}


module.exports = {

  recognizeImage,

  tesseractPath

};