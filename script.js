/* =====================================================
   RECEIPTBRAIN
   COMPLETE RECEIPT PROCESSING ENGINE

   FEATURES:
   - Receipt image
   - Receipt text
   - OCR
   - Large amounts
   - Indian comma formatting
   - Decimal amounts
   - Quantity detection
   - Categories
   - Expense insights
===================================================== */


/* =====================================================
   DOM ELEMENTS
===================================================== */

const imageTab =
    document.getElementById("imageTab");

const textTab =
    document.getElementById("textTab");

const imagePanel =
    document.getElementById("imagePanel");

const textPanel =
    document.getElementById("textPanel");

const receiptInput =
    document.getElementById("receiptInput");

const browseButton =
    document.getElementById("browseButton");

const dropZone =
    document.getElementById("dropZone");

const selectedFile =
    document.getElementById("selectedFile");

const fileName =
    document.getElementById("fileName");

const removeFile =
    document.getElementById("removeFile");

const receiptText =
    document.getElementById("receiptText");

const characterCount =
    document.getElementById("characterCount");

const analyseButton =
    document.getElementById("analyseButton");

const statusElement =
    document.getElementById("status");

const progressContainer =
    document.getElementById("progressContainer");

const progressBar =
    document.getElementById("progressBar");

const results =
    document.getElementById("results");

const totalAmount =
    document.getElementById("totalAmount");

const itemCount =
    document.getElementById("itemCount");

const inputSource =
    document.getElementById("inputSource");

const itemsList =
    document.getElementById("itemsList");

const foodAmount =
    document.getElementById("foodAmount");

const groceryAmount =
    document.getElementById("groceryAmount");

const transportAmount =
    document.getElementById("transportAmount");

const otherAmount =
    document.getElementById("otherAmount");

const recommendationText =
    document.getElementById("recommendationText");

const extractedText =
    document.getElementById("extractedText");

const reanalyseText =
    document.getElementById("reanalyseText");

const newReceiptButton =
    document.getElementById("newReceiptButton");


/* =====================================================
   STATE
===================================================== */

let currentInput = "image";

let selectedImage = null;

let lastReceipt = null;

let ocrWorker = null;

let workerReady = false;

let ocrStarting = null;


/* =====================================================
   INPUT TABS
===================================================== */

imageTab.addEventListener(
    "click",
    () => {
        switchInput("image");
    }
);


textTab.addEventListener(
    "click",
    () => {
        switchInput("text");
    }
);


function switchInput(type) {

    currentInput = type;

    if (type === "image") {

        imageTab.classList.add("active");

        textTab.classList.remove("active");

        imagePanel.classList.remove("hidden");

        textPanel.classList.add("hidden");

    } else {

        textTab.classList.add("active");

        imageTab.classList.remove("active");

        textPanel.classList.remove("hidden");

        imagePanel.classList.add("hidden");
    }

    updateButtonState();
}


/* =====================================================
   IMAGE SELECTION
===================================================== */

browseButton.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        receiptInput.click();
    }
);


dropZone.addEventListener(
    "click",
    event => {

        if (
            event.target === browseButton
        ) {
            return;
        }

        receiptInput.click();
    }
);


receiptInput.addEventListener(
    "change",
    event => {

        const file =
            event.target.files[0];

        if (file) {

            selectImage(file);
        }
    }
);


/* =====================================================
   DRAG AND DROP
===================================================== */

dropZone.addEventListener(
    "dragover",
    event => {

        event.preventDefault();

        dropZone.classList.add(
            "dragging"
        );
    }
);


dropZone.addEventListener(
    "dragleave",
    () => {

        dropZone.classList.remove(
            "dragging"
        );
    }
);


dropZone.addEventListener(
    "drop",
    event => {

        event.preventDefault();

        dropZone.classList.remove(
            "dragging"
        );

        const file =
            event.dataTransfer.files[0];

        if (file) {

            selectImage(file);
        }
    }
);


/* =====================================================
   SELECT IMAGE
===================================================== */

function selectImage(file) {

    const validTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];


    if (!validTypes.includes(file.type)) {

        showError(
            "Please select a JPG, PNG or WEBP image."
        );

        return;
    }


    if (
        file.size >
        15 * 1024 * 1024
    ) {

        showError(
            "Image is too large. Maximum size is 15 MB."
        );

        return;
    }


    selectedImage = file;

    fileName.textContent =
        file.name;

    selectedFile.classList.remove(
        "hidden"
    );


    statusElement.textContent =
        "Receipt image ready.";

    statusElement.className =
        "status";


    updateButtonState();
}


/* =====================================================
   REMOVE IMAGE
===================================================== */

removeFile.addEventListener(
    "click",
    () => {

        selectedImage = null;

        receiptInput.value = "";

        selectedFile.classList.add(
            "hidden"
        );

        statusElement.textContent =
            "Select a receipt image.";

        statusElement.className =
            "status";

        updateButtonState();
    }
);


/* =====================================================
   TEXT COUNTER
===================================================== */

receiptText.addEventListener(
    "input",
    () => {

        const length =
            receiptText.value.length;

        characterCount.textContent =
            `${length} characters`;

        updateButtonState();
    }
);


/* =====================================================
   BUTTON STATE
===================================================== */

function updateButtonState() {

    if (currentInput === "image") {

        analyseButton.disabled =
            !selectedImage;

    } else {

        analyseButton.disabled =
            receiptText.value.trim().length === 0;
    }
}


/* =====================================================
   ANALYSE BUTTON
===================================================== */

analyseButton.addEventListener(
    "click",
    async () => {

        if (
            analyseButton.disabled
        ) {
            return;
        }


        if (
            currentInput === "text"
        ) {

            analyseTextInput();

        } else {

            await analyseImage();
        }
    }
);


/* =====================================================
   TEXT ANALYSIS
===================================================== */

function analyseTextInput() {

    const text =
        receiptText.value.trim();


    if (!text) {

        showError(
            "Please enter receipt text."
        );

        return;
    }


    setProcessing(
        true,
        "Processing receipt text..."
    );


    setTimeout(
        () => {

            try {

                const receipt =
                    parseReceipt(text);


                lastReceipt =
                    receipt;


                displayResults(
                    receipt,
                    "TEXT"
                );


                extractedText.value =
                    text;


                setSuccess(
                    `Receipt analysed successfully. ${receipt.items.length} items detected.`
                );

            } catch (error) {

                console.error(
                    "TEXT ANALYSIS ERROR:",
                    error
                );

                showError(
                    "Unable to analyse receipt text."
                );

            } finally {

                setProcessing(false);
            }

        },
        50
    );
}


/* =====================================================
   IMAGE ANALYSIS
===================================================== */

async function analyseImage() {

    if (!selectedImage) {

        showError(
            "Please select an image first."
        );

        return;
    }


    try {

        setProcessing(
            true,
            "Preparing receipt image..."
        );


        const optimizedImage =
            await optimizeImage(
                selectedImage
            );


        setStatus(
            "Starting OCR..."
        );


        await initializeOCR();


        setStatus(
            "Reading receipt..."
        );


        const result =
            await ocrWorker.recognize(
                optimizedImage
            );


        const text =
            result.data.text;


        if (
            !text ||
            text.trim().length < 5
        ) {

            throw new Error(
                "OCR returned insufficient text."
            );
        }


        extractedText.value =
            text;


        setStatus(
            "Structuring receipt data..."
        );


        const receipt =
            parseReceipt(text);


        lastReceipt =
            receipt;


        displayResults(
            receipt,
            "IMAGE"
        );


        setSuccess(
            `Receipt processed. ${receipt.items.length} items detected.`
        );

    } catch (error) {

        console.error(
            "OCR ERROR:",
            error
        );


        showError(
            getOCRErrorMessage(error)
        );

    } finally {

        setProcessing(false);
    }
}


/* =====================================================
   OCR ERROR MESSAGE
===================================================== */

function getOCRErrorMessage(error) {

    const message =
        String(
            error?.message || ""
        ).toLowerCase();


    if (
        message.includes(
            "tesseract"
        ) ||
        message.includes(
            "worker"
        )
    ) {

        return (
            "OCR engine could not start. " +
            "Check your internet connection and reload the page."
        );
    }


    if (
        message.includes(
            "network"
        )
    ) {

        return (
            "OCR network error. " +
            "Please check your internet connection."
        );
    }


    if (
        message.includes(
            "insufficient"
        )
    ) {

        return (
            "The receipt text could not be detected. " +
            "Try a clearer, well-lit image."
        );
    }


    return (
        "Could not read this receipt. " +
        "Try a clearer image."
    );
}


/* =====================================================
   OCR INITIALIZATION
===================================================== */

async function initializeOCR() {

    if (
        workerReady &&
        ocrWorker
    ) {
        return;
    }


    if (
        typeof Tesseract ===
        "undefined"
    ) {

        throw new Error(
            "Tesseract.js is not loaded."
        );
    }


    /*
        Prevent two OCR workers from being
        created at the same time.
    */

    if (ocrStarting) {

        await ocrStarting;

        return;
    }


    ocrStarting =
        (async () => {

            try {

                ocrWorker =
                    await Tesseract.createWorker(
                        "eng",
                        1,
                        {
                            logger:
                                message => {

                                    if (
                                        message.status ===
                                        "recognizing text"
                                    ) {

                                        const percent =
                                            Math.round(
                                                message.progress *
                                                100
                                            );


                                        progressBar.style.width =
                                            `${percent}%`;


                                        statusElement.textContent =
                                            `Reading receipt... ${percent}%`;
                                    }
                                }
                        }
                    );


                workerReady = true;

            } catch (error) {

                console.error(
                    "OCR INITIALIZATION ERROR:",
                    error
                );


                ocrWorker = null;

                workerReady = false;

                throw error;

            } finally {

                ocrStarting = null;
            }

        })();


    await ocrStarting;
}


/* =====================================================
   IMAGE OPTIMIZATION
===================================================== */

function optimizeImage(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onload =
                event => {

                    const image =
                        new Image();


                    image.onload =
                        () => {

                            const MAX_WIDTH =
                                1600;


                            let width =
                                image.width;

                            let height =
                                image.height;


                            if (
                                width >
                                MAX_WIDTH
                            ) {

                                const ratio =
                                    MAX_WIDTH /
                                    width;


                                width =
                                    MAX_WIDTH;


                                height =
                                    Math.round(
                                        height *
                                        ratio
                                    );
                            }


                            const canvas =
                                document.createElement(
                                    "canvas"
                                );


                            canvas.width =
                                width;

                            canvas.height =
                                height;


                            const context =
                                canvas.getContext(
                                    "2d"
                                );


                            context.fillStyle =
                                "#ffffff";


                            context.fillRect(
                                0,
                                0,
                                width,
                                height
                            );


                            context.drawImage(
                                image,
                                0,
                                0,
                                width,
                                height
                            );


                            canvas.toBlob(
                                blob => {

                                    if (!blob) {

                                        reject(
                                            new Error(
                                                "Image conversion failed."
                                            )
                                        );

                                        return;
                                    }


                                    resolve(blob);

                                },
                                "image/jpeg",
                                0.85
                            );
                        };


                    image.onerror =
                        () => {

                            reject(
                                new Error(
                                    "Invalid image."
                                )
                            );
                        };


                    image.src =
                        event.target.result;
                };


            reader.onerror =
                () => {

                    reject(
                        new Error(
                            "Could not read image."
                        )
                    );
                };


            reader.readAsDataURL(
                file
            );
        }
    );
}


/* =====================================================
   RECEIPT PARSER
===================================================== */

function parseReceipt(text) {

    const normalized =
        String(text)
            .replace(
                /\r/g,
                ""
            )
            .replace(
                /[|]/g,
                " "
            )
            .replace(
                /[ \t]+/g,
                " "
            );


    const lines =
        normalized
            .split("\n")
            .map(
                line =>
                    line.trim()
            )
            .filter(
                line =>
                    line.length > 0
            );


    const items = [];

    let explicitTotal =
        null;


    /* =====================================
       FIND EXPLICIT TOTAL
    ====================================== */

    for (
        const line of lines
    ) {

        const lower =
            line.toLowerCase();


        if (
            lower.includes(
                "grand total"
            ) ||
            lower.includes(
                "amount due"
            ) ||
            /^total\b/i.test(
                lower
            ) ||
            lower.includes(
                "net total"
            ) ||
            lower.includes(
                "total amount"
            )
        ) {

            const price =
                extractPrice(line);


            if (
                price !== null
            ) {

                explicitTotal =
                    price;
            }
        }
    }


    /* =====================================
       FIND ITEMS
    ====================================== */

    for (
        const line of lines
    ) {

        const lower =
            line.toLowerCase();


        if (
            isNonItemLine(lower)
        ) {
            continue;
        }


        const price =
            extractPrice(line);


        if (
            price === null ||
            price <= 0
        ) {
            continue;
        }


        let name =
            removePrice(
                line
            );


        const quantityInfo =
            extractQuantity(name);


        name =
            quantityInfo.name;


        const quantity =
            quantityInfo.quantity;


        name =
            cleanItemName(name);


        if (
            name.length < 2 ||
            /^\d+$/.test(name)
        ) {
            continue;
        }


        /*
            Avoid treating a line containing
            only a price as an item.
        */

        if (
            looksLikeOnlyNumber(name)
        ) {
            continue;
        }


        items.push({

            name: name,

            quantity: quantity,

            price: price,

            category:
                detectCategory(name)

        });
    }


    /* =====================================
       TOTAL
    ====================================== */

    let total =
        explicitTotal;


    if (
        total === null
    ) {

        total =
            items.reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    item.price,
                0
            );
    }


    /* =====================================
       CATEGORIES
    ====================================== */

    const categories =
        calculateCategories(
            items
        );


    return {

        items: items,

        total: total,

        categories: categories,

        rawText: text

    };
}


/* =====================================================
   NON-ITEM LINES
===================================================== */

function isNonItemLine(line) {

    const ignoredWords = [

        "total",
        "subtotal",
        "grand total",
        "amount due",
        "change",
        "cash",
        "card",
        "credit",
        "debit",
        "gst",
        "cgst",
        "sgst",
        "igst",
        "tax",
        "discount",
        "invoice",
        "receipt",
        "bill",
        "phone",
        "tel",
        "address",
        "thank you",
        "date",
        "time",
        "cashier",
        "payment",
        "balance",
        "round off",
        "rounding"

    ];


    return ignoredWords.some(
        word =>
            line.includes(word)
    );
}


/* =====================================================
   LARGE PRICE EXTRACTION
===================================================== */

function extractPrice(line) {

    if (!line) {
        return null;
    }


    /*
        Currency-first matching.

        Supports:

        ₹999

        ₹9999

        ₹99999

        ₹999999

        ₹1,23,456

        ₹12,34,567

        ₹123456789

        ₹123456789.50

        Rs 123456

        INR 123456
    */

    const currencyPattern =
        /(?:₹|rs\.?|inr)\s*\d+(?:,\d{2,3})*(?:\.\d{1,2})?/gi;


    const currencyMatches =
        line.match(
            currencyPattern
        );


    if (
        currencyMatches &&
        currencyMatches.length
    ) {

        const last =
            currencyMatches[
                currencyMatches.length - 1
            ];


        const number =
            last
                .replace(
                    /₹|rs\.?|inr/gi,
                    ""
                )
                .replace(
                    /,/g,
                    ""
                )
                .trim();


        const value =
            Number(number);


        if (
            Number.isFinite(value)
        ) {

            return value;
        }
    }


    /*
        No currency symbol.

        \d+ means unlimited digits
        rather than \d{1,3}.
    */

    const numberPattern =
        /(?<![A-Za-z])\d+(?:,\d{2,3})*(?:\.\d{1,2})?(?![A-Za-z])/g;


    const matches =
        line.match(
            numberPattern
        );


    if (
        !matches ||
        matches.length === 0
    ) {

        return null;
    }


    /*
        The final number on a receipt
        line is usually the price.
    */

    for (
        let i =
            matches.length - 1;

        i >= 0;

        i--
    ) {

        const cleaned =
            matches[i]
                .replace(
                    /,/g,
                    ""
                );


        const value =
            Number(cleaned);


        if (
            Number.isFinite(value) &&
            value > 0
        ) {

            return value;
        }
    }


    return null;
}


/* =====================================================
   REMOVE PRICE
===================================================== */

function removePrice(line) {

    /*
        Removes the final price.

        Examples:

        Laptop 125000

        Laptop ₹125000

        Laptop ₹1,25,000

        Laptop 125000.50
    */

    const pattern =
        /(?:₹|rs\.?|inr)?\s*\d+(?:,\d{2,3})*(?:\.\d{1,2})?\s*$/i;


    return line
        .replace(
            pattern,
            ""
        )
        .trim();
}


/* =====================================================
   QUANTITY
===================================================== */

function extractQuantity(name) {

    let quantity = 1;

    let cleanName = name;


    /* 2 x Milk */

    let match =
        cleanName.match(
            /^(\d+)\s*x\s+/i
        );


    if (match) {

        quantity =
            parseInt(
                match[1],
                10
            );


        cleanName =
            cleanName.replace(
                /^(\d+)\s*x\s+/i,
                ""
            );
    }


    /* Milk x 2 */

    match =
        cleanName.match(
            /\s*x\s*(\d+)\s*$/i
        );


    if (match) {

        quantity =
            parseInt(
                match[1],
                10
            );


        cleanName =
            cleanName.replace(
                /\s*x\s*(\d+)\s*$/i,
                ""
            );
    }


    /* 2 pcs Milk */

    match =
        cleanName.match(
            /^(\d+)\s*(pcs?|qty)\s+/i
        );


    if (match) {

        quantity =
            parseInt(
                match[1],
                10
            );


        cleanName =
            cleanName.replace(
                /^(\d+)\s*(pcs?|qty)\s+/i,
                ""
            );
    }


    return {

        name: cleanName,

        quantity:
            Number.isFinite(quantity) &&
            quantity > 0
                ? quantity
                : 1

    };
}


/* =====================================================
   CLEAN ITEM
===================================================== */

function cleanItemName(name) {

    return name

        .replace(
            /^\s*[-:./]+\s*/,
            ""
        )

        .replace(
            /\s+/g,
            " "
        )

        .trim();
}


/* =====================================================
   CHECK NUMBER-ONLY NAME
===================================================== */

function looksLikeOnlyNumber(
    name
) {

    return /^[₹$€£\d,.\s]+$/.test(
        name
    );
}


/* =====================================================
   CATEGORY
===================================================== */

function detectCategory(name) {

    const item =
        name.toLowerCase();


    const foodWords = [

        "pizza",
        "burger",
        "sandwich",
        "coffee",
        "tea",
        "juice",
        "cake",
        "snack",
        "chips",
        "restaurant",
        "meal",
        "chicken",
        "biryani",
        "food",
        "dosa",
        "idli",
        "paratha",
        "noodles",
        "fries",
        "pasta",
        "rice",
        "curry"

    ];


    const groceryWords = [

        "milk",
        "bread",
        "rice",
        "flour",
        "sugar",
        "salt",
        "oil",
        "vegetable",
        "fruit",
        "apple",
        "banana",
        "potato",
        "onion",
        "tomato",
        "dal",
        "egg",
        "eggs",
        "grocery",
        "soap",
        "detergent"

    ];


    const transportWords = [

        "petrol",
        "diesel",
        "fuel",
        "uber",
        "ola",
        "taxi",
        "metro",
        "bus",
        "train",
        "parking",
        "transport",
        "auto",
        "rickshaw"

    ];


    if (
        foodWords.some(
            word =>
                item.includes(word)
        )
    ) {

        return "food";
    }


    if (
        groceryWords.some(
            word =>
                item.includes(word)
        )
    ) {

        return "groceries";
    }


    if (
        transportWords.some(
            word =>
                item.includes(word)
        )
    ) {

        return "transport";
    }


    return "other";
}


/* =====================================================
   CATEGORY CALCULATION
===================================================== */

function calculateCategories(
    items
) {

    const categories = {

        food: 0,

        groceries: 0,

        transport: 0,

        other: 0

    };


    items.forEach(
        item => {

            categories[
                item.category
            ] += item.price;
        }
    );


    return categories;
}


/* =====================================================
   DISPLAY RESULTS
===================================================== */

function displayResults(
    receipt,
    source
) {

    results.classList.remove(
        "hidden"
    );


    totalAmount.textContent =
        formatCurrency(
            receipt.total
        );


    itemCount.textContent =
        receipt.items.length;


    inputSource.textContent =
        source;


    displayItems(
        receipt.items
    );


    displayCategories(
        receipt.categories
    );


    generateRecommendation(
        receipt
    );


    setTimeout(
        () => {

            results.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        },
        100
    );
}


/* =====================================================
   DISPLAY ITEMS
===================================================== */

function displayItems(
    items
) {

    itemsList.innerHTML = "";


    if (
        items.length === 0
    ) {

        itemsList.innerHTML = `

            <div class="item">

                <span>
                    No individual items detected
                </span>

                <span>
                    —
                </span>

                <span class="item-price">
                    —
                </span>

            </div>

        `;

        return;
    }


    items.forEach(
        item => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "item";


            row.innerHTML = `

                <span>
                    ${escapeHTML(
                        item.name
                    )}
                </span>

                <span class="item-quantity">
                    ${item.quantity}
                </span>

                <span class="item-price">
                    ${formatCurrency(
                        item.price
                    )}
                </span>

            `;


            itemsList.appendChild(
                row
            );
        }
    );
}


/* =====================================================
   DISPLAY CATEGORIES
===================================================== */

function displayCategories(
    categories
) {

    foodAmount.textContent =
        formatCurrency(
            categories.food
        );


    groceryAmount.textContent =
        formatCurrency(
            categories.groceries
        );


    transportAmount.textContent =
        formatCurrency(
            categories.transport
        );


    otherAmount.textContent =
        formatCurrency(
            categories.other
        );
}


/* =====================================================
   INSIGHT
===================================================== */

function generateRecommendation(
    receipt
) {

    const total =
        receipt.total;


    if (
        total <= 0
    ) {

        recommendationText.textContent =
            "No spending could be calculated.";

        return;
    }


    const categories =
        receipt.categories;


    const entries =
        Object.entries(
            categories
        );


    entries.sort(
        (a, b) =>
            b[1] - a[1]
    );


    const largest =
        entries[0];


    const percentage =
        total > 0
            ? (
                largest[1] /
                total
            ) * 100
            : 0;


    recommendationText.textContent =
        `${capitalize(
            largest[0]
        )} represents approximately ${percentage.toFixed(
            0
        )}% of this receipt. Continue tracking receipts to identify monthly spending patterns.`;
}


/* =====================================================
   CURRENCY
===================================================== */

function formatCurrency(
    value
) {

    const safeValue =
        Number(value);


    if (
        !Number.isFinite(
            safeValue
        )
    ) {

        return "₹0.00";
    }


    return new Intl.NumberFormat(
        "en-IN",
        {
            style: "currency",

            currency: "INR",

            minimumFractionDigits: 2,

            maximumFractionDigits: 2
        }
    ).format(
        safeValue
    );
}


/* =====================================================
   CAPITALIZE
===================================================== */

function capitalize(text) {

    return (
        text
            .charAt(0)
            .toUpperCase()
        +
        text.slice(1)
    );
}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(
    value
) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


/* =====================================================
   PROCESSING UI
===================================================== */

function setProcessing(
    processing,
    message
) {

    if (
        processing
    ) {

        analyseButton.disabled =
            true;


        analyseButton.textContent =
            "PROCESSING...";


        progressContainer.classList.add(
            "active"
        );


        progressBar.style.width =
            "5%";


        statusElement.className =
            "status processing";


        if (message) {

            statusElement.textContent =
                message;
        }

    } else {

        updateButtonState();

        analyseButton.textContent =
            "ANALYSE RECEIPT";
    }
}


/* =====================================================
   STATUS
===================================================== */

function setStatus(
    message
) {

    statusElement.textContent =
        message;

    statusElement.className =
        "status processing";
}


function setSuccess(
    message
) {

    statusElement.textContent =
        message;

    statusElement.className =
        "status success";

    progressBar.style.width =
        "100%";
}


function showError(
    message
) {

    statusElement.textContent =
        message;

    statusElement.className =
        "status error";

    progressContainer.classList.add(
        "active"
    );

    progressBar.style.width =
        "0%";
}


/* =====================================================
   RE-ANALYSE EDITED TEXT
===================================================== */

reanalyseText.addEventListener(
    "click",
    () => {

        const text =
            extractedText.value.trim();


        if (!text) {

            showError(
                "There is no extracted text to analyse."
            );

            return;
        }


        try {

            const receipt =
                parseReceipt(text);


            lastReceipt =
                receipt;


            displayResults(
                receipt,
                "EDITED TEXT"
            );


            setSuccess(
                "Edited receipt text analysed."
            );

        } catch (error) {

            console.error(
                error
            );

            showError(
                "Unable to analyse edited text."
            );
        }
    }
);


/* =====================================================
   NEW RECEIPT
===================================================== */

newReceiptButton.addEventListener(
    "click",
    () => {

        resetApplication();
    }
);


/* =====================================================
   RESET
===================================================== */

function resetApplication() {

    selectedImage = null;

    lastReceipt = null;


    receiptInput.value = "";

    receiptText.value = "";

    extractedText.value = "";


    characterCount.textContent =
        "0 characters";


    selectedFile.classList.add(
        "hidden"
    );


    results.classList.add(
        "hidden"
    );


    progressContainer.classList.remove(
        "active"
    );


    progressBar.style.width =
        "0%";


    statusElement.textContent =
        "Select an image or enter receipt text.";

    statusElement.className =
        "status";


    switchInput(
        "image"
    );


    updateButtonState();


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =====================================================
   INITIALIZE
===================================================== */

updateButtonState();