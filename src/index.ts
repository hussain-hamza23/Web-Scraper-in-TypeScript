import { extractPageData } from './crawl';


function main() {
    const args = process.argv.slice(2);

    if (args.length !== 1) {
        console.error(
            args.length > 1 ?
                "Please provide only one URL as an argument" :
                "Please provide a URL as an argument"
        )
        process.exit(1);
    }
    console.log(`Crawling URL: ${args[0]}`);
    process.exit(0);

}

main();