function localInsight(
  analytics
) {

  const total =
    Number(
      analytics?.monthlyTotal ||
      0
    );


  const categories =
    Array.isArray(
      analytics?.categories
    )
      ? analytics.categories
      : [];


  if (
    !analytics?.receiptCount
  ) {

    return (
      'Add a few receipts and ReceiptBrain will start identifying your spending patterns.'
    );

  }


  if (
    !categories.length
  ) {

    return (

      `You have tracked ₹${total.toLocaleString(
        'en-IN'
      )} this month. Add item-level receipts for more detailed category insights.`

    );

  }


  const top =
    categories[0];


  const share =
    total > 0

      ? Math.round(

          (
            Number(top.total) /
            total
          ) * 100

        )

      : 0;


  return (

    `Your largest tracked category is ${top.category} at ₹${Number(top.total).toLocaleString(
      'en-IN'
    )}, about ${share}% of this month's spending. Review repeated purchases in this category first.`

  );

}


function hasAIConfig(
  config
) {

  const apiKey =
    String(
      config.openaiApiKey ||
      process.env.OPENAI_API_KEY ||
      ''
    ).trim();


  const model =
    String(
      config.openaiModel ||
      process.env.OPENAI_MODEL ||
      ''
    ).trim();


  return Boolean(
    apiKey &&
    model
  );

}


async function generateInsight(
  analytics,
  config
) {

  const apiKey =
    String(
      config.openaiApiKey ||
      process.env.OPENAI_API_KEY ||
      ''
    ).trim();


  const model =
    String(
      config.openaiModel ||
      process.env.OPENAI_MODEL ||
      ''
    ).trim();


  if (
    !apiKey ||
    !model
  ) {

    return {

      text:
        localInsight(
          analytics
        ),

      aiAvailable:
        false,

      provider:
        'local'

    };

  }


  try {

    const prompt =
      [

        'You are ReceiptBrain, a personal expense-analysis assistant.',

        'Analyze only the supplied spending data.',

        'Do not invent purchases, income, dates, or financial facts.',

        'Give exactly 3 short sentences with practical observations.',

        'Do not use markdown bullets.',

        '',

        JSON.stringify(
          analytics,
          null,
          2
        )

      ].join('\n');


    const response =
      await fetch(

        'https://api.openai.com/v1/responses',

        {

          method:
            'POST',

          headers: {

            'Content-Type':
              'application/json',

            'Authorization':
              `Bearer ${apiKey}`

          },

          body:
            JSON.stringify({

              model,

              input:
                prompt

            })

        }

      );


    const data =
      await response
        .json()
        .catch(
          () => ({})
        );


    if (!response.ok) {

      throw new Error(

        data?.error?.message ||

        `OpenAI request failed (${response.status}).`

      );

    }


    const text =
      String(

        data?.output_text ||

        extractResponseText(
          data
        ) ||

        ''

      ).trim();


    if (!text) {

      throw new Error(
        'AI returned an empty response.'
      );

    }


    return {

      text,

      aiAvailable:
        true,

      provider:
        'openai'

    };

  } catch (error) {

    return {

      text:
        localInsight(
          analytics
        ),

      aiAvailable:
        false,

      provider:
        'local-fallback',

      error:
        error?.message ||
        'AI request failed'

    };

  }

}


function extractResponseText(
  data
) {

  if (
    !Array.isArray(
      data?.output
    )
  ) {

    return '';

  }


  return data.output

    .flatMap(
      (item) =>
        Array.isArray(
          item?.content
        )
          ? item.content
          : []
    )

    .filter(
      (part) =>
        part?.type ===
        'output_text'
    )

    .map(
      (part) =>
        part.text || ''
    )

    .join('\n');

}


module.exports = {

  generateInsight,

  hasAIConfig

};