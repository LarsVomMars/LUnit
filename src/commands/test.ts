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
            } else {
                if (data.interactions.at(-1)!.output)
                    data.interactions.at(-1)!.output += line + "\n";
                else data.interactions.at(-1)!.output = line + "\n";
            }
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
        execClass = await findFile(execPath, entry + ".class");
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

    // TODO: Clean up
    const clazz = execClass
        .replace(execPath, "")
        .replace(/\\/g, "/")
        .replace(".class", "")
        .substring(1);

    const data = parseTestFile(testFile, test);
    const proc = spawn("java", [clazz, ...data.args], { cwd: execPath });

    const output = () =>
        new Promise((resolve) =>
            proc.stdout.on("data", (data) => resolve(data.toString()))
        );
    const error = () =>
        new Promise((resolve) =>
            proc.stderr.on("data", (data) => resolve(data.toString()))
        );
    proc.on("error", (e) => console.error(e.toString()));
    // TODO: Check against instruction.exit
    proc.on("close", (code) => console.log("Exited with code: " + code));

    for (const interaction of data.interactions) {
        console.log(interaction);
        if (interaction.input) {
            proc.stdin.write(interaction.input);
        }
        if (interaction.output) {
            // TODO: Fix multiple expected outputs that are interpreted as one interaction but multiple outputs
            const result = await output();
            if (result !== interaction.output) {
                console.log("Output mismatch!");
                console.log("Expected:");
                console.log(interaction.output);
                console.log("Got:");
                console.log(result);
                process.exit(4);
            }
        } else if (interaction.error) {
            const result = await error();
            if (result !== interaction.output) {
                console.log("Error mismatch!");
                console.log("Expected:");
                console.log(interaction.output);
                console.log("Got:");
                console.log(result);
                process.exit(4);
            }
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
