const https = require('https');
const fetch = require('node-fetch');
const _ = require('lodash');

// --- Start of errors.js content ---
const errors = {
    NoDefinitionsFound: class NoDefinitionsFound extends Error {
        constructor (additionalInfo = {}) {
            super();
            this.name = 'NoDefinitionsFound';
            this.title = 'No Definitions Found';
            this.message = 'Sorry pal, we couldn\'t find definitions for the word you were looking for.';
            this.resolution = 'You can try the search again at later time or head to the web instead.';
            this.additionalInfo = additionalInfo;
            this.requestType = 'notFound';
        }
    },
    RateLimitError: class RateLimitError extends Error {
        constructor (additionalInfo = {}) {
            super();
            this.name = 'RateLimitError';
            this.title = 'API Rate Limit Exceeded';
            this.message = 'Sorry pal, you were just rate limited by the upstream server.';
            this.resolution = 'You can try the search again at later time or head to the web instead.';
            this.additionalInfo = additionalInfo;
            this.requestType = 'rateLimit';
        }
    },
    UnexpectedError: class UnexpectedError extends Error {
        constructor (additionalInfo = {}) {
            super();
            this.name = 'UnexpectedError';
            this.title = 'Something Went Wrong';
            this.message = 'Sorry pal, something went wrong, and it\'s not your fault.';
            this.resolution = 'You can try the search again at later time or head to the web instead.';
            this.additionalInfo = additionalInfo;
            this.requestType = 'serverError';
        }
    }
};
// --- End of errors.js content ---

// --- Start of utils.js content ---
const utils = {
    logEvent (word, language, message, additionalInfo = {}) {
        console.log({
            'Word': word,
            'Language': language,
            'Message': message,
            'AdditionalInfo': JSON.stringify(additionalInfo)
        });
    }
};
// --- End of utils.js content ---

// --- Start of dictionary.js content ---
const httpsAgent = new https.Agent({ keepAlive: true });

function transform(word, language, data) {
    return data
        .map(e => e.entry)
        .filter(e => e)
        .reduce((accumulator, entry) => {
            if (!entry.subentries) { accumulator.push(entry); return accumulator; }
            let { subentries } = entry;
            if (subentries.length > 1) { utils.logEvent(word, language, 'subentries length is greater than 1', { data }); }
            if (entry.sense_families) { utils.logEvent(word, language, 'entry has subentries and sense families', { data }); }
            if (entry.etymology) { utils.logEvent(word, language, 'entry has subentries and etymology', { data }); }
            let mappedSubentries = subentries.map((subentry) => {
                if (subentry.sense_families) { utils.logEvent(word, language, 'subentry has sense families', { data }); }
                if (subentry.sense_family) {
                    subentry.sense_families = [];
                    subentry.sense_families.push(subentry.sense_family);
                }
                return _.defaults(subentry, _.pick(entry, ['phonetics', 'etymology']));
            });
            return accumulator.concat(mappedSubentries);
        }, [])
        .map((entry) => {
            let { headword, lemma, phonetics = [], sense_families = [] } = entry;
            return {
                word: lemma || headword,
                phonetic: _.get(phonetics, '0.text'),
                phonetics: phonetics.map((e) => ({
                    text: e.text,
                    audio: e.oxford_audio
                })),
                origin: _.get(entry, 'etymology.etymology.text'),
                meanings: sense_families.map((sense_family) => {
                    let { parts_of_speech, senses = [] } = sense_family;
                    if (!parts_of_speech) {
                        parts_of_speech = _.get(senses[0], 'parts_of_speech', []);
                        if (senses.length > 1) { utils.logEvent(word, language, 'part of speech missing but more than one sense present', { data }); }
                    }
                    if (parts_of_speech.length > 1) { utils.logEvent(word, language, 'more than one part of speech present', { data }); }
                    return {
                        partOfSpeech: _.get(parts_of_speech[0], 'value'),
                        definitions: senses.map((sense) => {
                            let { definition = {}, example_groups = [] } = sense;
                            return {
                                definition: definition.text,
                                example: _.get(example_groups[0], 'examples.0'),
                                synonyms: _.get(sense, 'thesaurus_entries.0.synonyms.0.nyms', []).map(e => e.nym),
                                antonyms: _.get(sense, 'thesaurus_entries.0.antonyms.0.nyms', []).map(e => e.nym)
                            };
                        })
                    };
                })
            };
        });
}

async function queryInternet(word, language) {
    let url = new URL('https://www.google.com/async/callback:5493');
    url.searchParams.set('fc', 'ErUBCndBTlVfTnFUN29LdXdNSlQ2VlZoWUIwWE1HaElOclFNU29TOFF4ZGxGbV9zbzA3YmQ2NnJyQXlHNVlrb3l3OXgtREpRbXpNZ0M1NWZPeFo4NjQyVlA3S2ZQOHpYa292MFBMaDQweGRNQjR4eTlld1E4bDlCbXFJMBIWU2JzSllkLVpHc3J5OVFPb3Q2aVlDZxoiQU9NWVJ3QmU2cHRlbjZEZmw5U0lXT1lOR3hsM2xBWGFldw');
    url.searchParams.set('fcv', '3');
    url.searchParams.set('async', `term:${encodeURIComponent(word)},corpus:${language},hhdr:true,hwdgt:true,wfp:true,ttl:,tsl:,ptl:`);
    
    let response = await fetch(url.toString(), {
        agent: httpsAgent,
        headers: new fetch.Headers({
            "accept": "*/*",
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "en-US,en;q=0.9",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36"
        })
    });

    if (response.status === 404) { throw new errors.NoDefinitionsFound({ reason: 'Website returned 404.' }); }
    if (response.status === 429) { throw new errors.RateLimitError(); }
    if (response.status !== 200) { throw new errors.NoDefinitionsFound({ reason: 'Threw non 200 status code.' }); }

    let body = await response.text();
    let data = JSON.parse(body.substring(4));
    let single_results = _.get(data, 'feature-callback.payload.single_results', []);
    let error = _.chain(single_results).find('widget').get('widget.error').value();

    if (single_results.length === 0) { throw new errors.NoDefinitionsFound({ word, language }); }
    if (error === 'TERM_NOT_FOUND_ERROR') { throw new errors.NoDefinitionsFound({ word, language }); }
    if (error) { throw new errors.UnexpectedError({ error }); }

    return single_results;
}

async function findDefinitions(word, language) {
    let dictionaryData = await queryInternet(word, language);
    if (_.isEmpty(dictionaryData)) { throw new errors.UnexpectedError(); }
    return transform(word, language, dictionaryData);
}
// --- End of dictionary.js content ---

// --- Vercel Serverless Function Handler ---
export default async function handler(req, res) {
    const { word } = req.query;
    const language = 'en'; // Hardcoding to English for this project

    if (!word) {
        return res.status(400).json({ error: 'Word parameter is required' });
    }

    try {
        const definitions = await findDefinitions(word.trim().toLowerCase(), language);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json(definitions);
    } catch (error) {
        const statusMap = {
            notFound: 404,
            rateLimit: 429,
            serverError: 500
        };
        const statusCode = statusMap[error.requestType] || 500;
        res.status(statusCode).json({
            title: error.title || 'Error',
            message: error.message || 'An unexpected error occurred.',
            resolution: error.resolution || ''
        });
    }
}
