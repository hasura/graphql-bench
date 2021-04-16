import neatCsv = require("neat-csv");
import { Benchmark } from "./types";
import fs from "fs-extra";
import path from "path";


export class Utils {

    /**
     * Asynchronously Read values from the CSV file and output as an Array of JSON values. The JSOn Object keys are the first row in the file, 
     * which must also be the variable name. Also supports nested Variables which are themselves JSON.
     * 
     * @param bench Benchmark
     * @returns neatCsv.Row[] - Array of objects pertaining to each row in the CSV file
     */
    static async readVariablesFromFile(bench: Benchmark) {
        let output: neatCsv.Row[] = [];
        if (
            bench.variable_file &&
            bench.variable_file.file_path
        ) {
            let varCsvFile = fs.createReadStream(
                path.join(process.cwd(), bench.variable_file.file_path)
            );
            let rows = await neatCsv(varCsvFile);
            rows.forEach((row) => {
                const keys = Object.keys(row);
                keys.forEach((key) => {
                    try {
                        row[key] = JSON.parse(row[key]);
                    } catch (error) {
                        // Suppress the unparseable json error.
                    }
                });
            });
            output = rows;
        }
        return output;
    }
}
