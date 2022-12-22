import yargs from "yargs";
import { test } from "./commands";

yargs
    .scriptName("LUnit")
    .version("1.0.0")
    .command(test.COMMAND, test.DESCRIPTION, test.builder, test.handler)
    .demandCommand()
    .help()
    .parse();
