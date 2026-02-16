import { extractPageData, getHTML, crawlPage, crawlSiteAsync } from './crawl';
import { URL } from 'url';

async function main() {
    const args = process.argv.slice(2);

    if (args.length !== 1) {
        console.error(
            args.length > 1 ?
                "Please provide only one URL as an argument" :
                "Please provide a URL as an argument"
        )
        process.exit(1);
    }
    const base_url: string = args[0];
    let url: URL;
    try {
        url = new URL(base_url);
    }
    catch (err) {
        console.error(`Invalid URL: ${base_url}\n ${err}`);
        process.exit(1);
    }
    console.log(`Crawling URL: ${base_url}`);
    const crawl = await crawlSiteAsync(url);

    console.log(crawl);
    //process.exit(0);
}

main();