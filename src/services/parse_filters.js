const dayjs = require("dayjs");

const filterRegex = /(\b(AND|OR)\s+)?@(!?)([\w_]+|"[^"]+")\s*((=|!=|<|<=|>|>=|!?\*=|!?=\*|!?\*=\*)\s*([\w_/-]+|"[^"]+"))?/ig;
const smartValueRegex = /^(NOW|TODAY|WEEK|MONTH|YEAR) *([+\-] *\d+)?$/i;

function calculateSmartValue(v) {
    const match = smartValueRegex.exec(v);
    if (match === null) {
        return;
    }

    const keyword = match[1].toUpperCase();
    const num = match[2] ? parseInt(match[2].replace(/ /g, "")) : 0; // can contain spaces between sign and digits

    let format, date;

    if (keyword === 'NOW') {
        date = dayjs().add(num, 'second');
        format = "YYYY-MM-DD HH:mm:ss";
    }
    else if (keyword === 'TODAY') {
        date = dayjs().add(num, 'day');
        format = "YYYY-MM-DD";
    }
    else if (keyword === 'WEEK') {
        // FIXME: this will always use sunday as start of the week
        date = dayjs().startOf('week').add(7 * num, 'day');
        format = "YYYY-MM-DD";
    }
    else if (keyword === 'MONTH') {
        date = dayjs().add(num, 'month');
        format = "YYYY-MM";
    }
    else if (keyword === 'YEAR') {
        date = dayjs().add(num, 'year');
        format = "YYYY";
    }
    else {
        throw new Error("Unrecognized keyword: " + keyword);
    }

    return date.format(format);
}

module.exports = function (searchText) {
    // if the string doesn't start with attribute then we consider it as just standard full text search
    if (!searchText.trim().startsWith("@")) {
        // replace with space instead of empty string since these characters are probably separators
        const sanitizedSearchText = searchText.replace(/[^\w ]+/g, " ");

        return [
            {
                relation: 'and',
                name: 'text',
                operator: '=',
                value: sanitizedSearchText
            },
            {
                relation: 'or',
                name: 'noteId',
                operator: '=',
                value: sanitizedSearchText
            }
        ]
    }

    const filters = [];

    function trimQuotes(str) { return str.startsWith('"') ? str.substr(1, str.length - 2) : str; }

    let match;

    while (match = filterRegex.exec(searchText)) {
        const relation = match[2] !== undefined ? match[2].toLowerCase() : 'and';
        const operator = match[3] === '!' ? 'not-exists' : 'exists';

        const value = match[7] !== undefined ? trimQuotes(match[7]) : null;

        filters.push({
            relation: relation,
            name: trimQuotes(match[4]),
            operator: match[6] !== undefined ? match[6] : operator,
            value: (
                value && value.match(smartValueRegex)
                    ? calculateSmartValue(value)
                    : value
            )
        });
    }

    return filters;
};
