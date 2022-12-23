# LUnit

LUnit is a small and ugly script to automate the process of testing the exercices (java console applications) of our programming lectures.  
Given an accordingly formatted test file, it will automatically run and test the console interactions we have to implement.

## Usage

### Test

Prerequisite: A build of the java application to test, located at `target/classes/*`  
Usage: `lunit test <Entry> <Test>`

-   Entry: The class name of the entry point into the application to test (usually _Main_)
-   Test: Path to the file containing the test

Example `lunit test Main tests/basic_example.test`

## Building

1. Clone the repository
2. Install dependencies `[yarn|npm|...] install`
3. Build the project `[yarn|npm|...] run build`

## Run

1. [Build](#building)
2. Run using either `node dist/index.js` or the `lunit` [shell script](/lunit)
3. I'd recommend adding the script to your path to be able to just call `lunit` from everywhere
