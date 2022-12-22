import type { Argv, ArgumentsCamelCase } from "yargs";
import { spawn } from "child_process";
import { join, normalize } from "path";
import { readdir, readFile } from "fs/promises";

Array.prototype.equals = function (array: any[]): boolean {
    return array.length === this.length && this.every((v, i) => v === array[i]);
};

const TARGET = "target/classes";

const findFile = async (
    dir: string,
    name: string
): Promise<string | undefined> => {
    const files = await readdir(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.isFile()) {
            if (file.name === name) return join(dir, name);
        } else if (file.isDirectory()) {
            const result = await findFile(join(dir, file.name), name);
            if (result) return result;
        }
    }
};

const getTestFile = async (dir: string, test: string): Promise<string> => {
    const path = normalize(join(dir, test));
    try {
        return await readFile(path, { encoding: "utf-8" });
    } catch (e: any) {
        if (e.code === "ENOENT") {
            console.log("No test file found!");
            process.exit(3);
        }
        console.error(e);
        process.exit(-2);
    }
};

const parseTestFile = (testData: string, name: string): TestFileData => {
    const data: TestFileData = { name, args: [], interactions: [] };
    const lines = testData.split("\n");

    while (lines.length > 0) {
        const line = lines.shift();

        if (!line) continue;

        if (line.startsWith("> ")) {
            // TODO: Fix this mess
            if (
                data.interactions.length > 0 &&
                Object.keys(data.interactions.at(-1)!).equals(["comment"])
            )
                data.interactions.at(-1)!.input = line.slice(2) + "\n";
            else data.interactions.push({ input: line.slice(2) + "\n" });
        } else if (line.startsWith("<e")) {
            if (data.interactions.length === 0) {
                data.interactions.push({ error: true });
            } else data.interactions.at(-1)!.error = true;
        } else if (line.startsWith("#")) {
            data.interactions.push({ comment: line.slice(1).trim() });
        } else if (line.startsWith("$$ ")) {
            data.args.push(line.slice(3));
        } else if (line.startsWith("<r")) {
            console.assert(0 && "Not implemented yet");
        } else if (line.startsWith("<l")) {
            console.assert(0 && "Not implemented yet");
        } else {
            if (data.interactions.length === 0) {
                data.interactions.push({ output: line + "\n" });
            } else data.interactions.at(-1)!.output += line + "\n";
        }
    }

    if (data.interactions.length > 0) data.interactions.at(-1)!.exit = true;

    return data;
};

export const COMMAND: string = "test <entry> <test>";
export const DESCRIPTION: string = "Run tests";
export const builder = (yargs: Argv): Argv =>
    yargs
        .positional("entry", {
            type: "string",
            description: "Entry class",
        })
        .positional("test", {
            type: "string",
            description: "Test file",
        })
        .option("kit", {
            type: "boolean",
            alias: "k",
            default: false,
            description: "Use kit format",
        });
export const handler = async (args: ArgumentsCamelCase<HandlerArgs>) => {
    const cwd = process.cwd();
    const execPath = join(cwd, TARGET);
    const { entry, test, kit } = args;

    let execClass;

    try {
        execClass = await findFile(execPath, entry);
        if (!execClass) {
            console.log("No entry class found!");
            process.exit(2);
        }
    } catch (e: any) {
        if (e.code === "ENOENT") {
            console.log("No target found!");
            process.exit(1);
        }
        console.error(e);
        process.exit(-1);
    }

    const testFile = await getTestFile(cwd, test);
    if (kit) {
        // TODO: Autodetect format
        // TODO: Convert test file to other format
    }
    const data = parseTestFile(testFile, test);
    const proc = spawn("java", [execClass, ...data.args], { cwd: execPath });

    let interaction: TestInteraction = {};

    proc.stdout.on("data", (_data) => {});
    proc.stderr.on("data", (_data) => {});
    proc.on("close", (_code) => {});

    for (let i = 0; i < data.interactions.length; i++) {
        interaction = data.interactions[i];
        if (interaction.input) {
            proc.stdin.write(interaction.input);
        }
    }
};

export interface HandlerArgs {
    entry: string;
    test: string;
    kit: boolean;
}

export interface TestFileData {
    name: string;
    args: string[];
    interactions: TestInteraction[];
}

export interface TestInteraction {
    comment?: string;
    input?: string;
    output?: string;
    error?: boolean;
    exit?: boolean;
}
