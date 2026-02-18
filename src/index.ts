import { crawlSiteAsync } from './crawl';
import { URL } from 'url';
import { writeCSVReport } from './report';

const MAX_CONCURRENCY: string = "10";
const MAX_PAGES: string = "100";

export function errorHandler<T>(promise: Promise<T>): Promise<[undefined, T] | [Error]>{
    return promise
        .then((data) => [undefined, data] as [undefined, T])
        .catch((err) => [err] as [Error]);
}

async function main() {
    if (process.argv.length > 5) {
        console.error("Too many arguments provided. Usage: node dist/index.js <URL> [maxConcurrency (optional)] [maxPages (optional)]");
        process.exit(1);
    }
    
    const base_url: string = process.argv[2];
    const userMaxConcurrency: string = process.argv[3] ?? MAX_CONCURRENCY;
    const userMaxPages: string = process.argv[4] ?? MAX_PAGES;

    let maxConcurrency: number = parseInt(userMaxConcurrency, 10);
    let maxPages: number = parseInt(userMaxPages, 10);
    if (isNaN(maxConcurrency) || maxConcurrency <= 0) {
        console.error(`Max concurrency must be a positive number. Invalid value: ${userMaxConcurrency}. Using default: ${MAX_CONCURRENCY}`);
        maxConcurrency = parseInt(MAX_CONCURRENCY, 10);
    }
    if (isNaN(maxPages) || maxPages <= 0) {
        console.error(`Max pages must be a positive number. Invalid value: ${userMaxPages}. Using default: ${MAX_PAGES}`);
        maxPages = parseInt(MAX_PAGES, 10);
    }

    if (!base_url) {
        console.error("Please provide a URL as an argument");
        process.exit(1);
    }
    let url: URL;
    try {
        url = new URL(base_url);
    }
    catch (err) {
        console.error(`Invalid URL: ${base_url}\n ${err}`);
        process.exit(1);
    }
    console.log(`Crawling URL: ${base_url}`);
    const crawl = await crawlSiteAsync(url, maxConcurrency, maxPages);

    console.log("Finished crawling.");
    writeCSVReport(crawl);
}

main();