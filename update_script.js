const fs = require('fs');
const path = require('path');

// --- Configuration Updated ---
const INPUT_FILE = 'errorQuestions.json'; // New input file name
const OUTPUT_FILE = 'questions.json';   // New output file name
const INPUT_PATH = path.join(__dirname, INPUT_FILE);
const OUTPUT_PATH = path.join(__dirname, OUTPUT_FILE);

function updateQuestionTypesByOptions() {
    let data;

    // 1. Read the JSON file
    try {
        const fileContent = fs.readFileSync(INPUT_PATH, 'utf8');
        data = JSON.parse(fileContent);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`❌ Error: Input file not found at '${INPUT_FILE}'. Please ensure the file is in the same directory.`);
        } else if (error instanceof SyntaxError) {
            console.error(`❌ Error: Could not parse JSON from '${INPUT_FILE}'. Check for syntax errors.`);
        } else {
            console.error(`❌ An unexpected error occurred: ${error.message}`);
        }
        return;
    }

    if (!Array.isArray(data)) {
        console.error("❌ Error: The root of the JSON file must be a list/array of question objects.");
        return;
    }

    let updateCount = 0;
    
    // 2. Iterate and Update the 'type' field
    data.forEach(question => {
        // If the object has the 'options' key, set the type to 'multiple-choice'
        if (question.hasOwnProperty('options')) {
            if (question.type !== 'multiple-choice') {
                question.type = 'multiple-choice';
                updateCount++;
            }
        }
    });
    
    // 3. Save the updated data to the new file
    try {
        const updatedContent = JSON.stringify(data, null, 4);
        fs.writeFileSync(OUTPUT_PATH, updatedContent, 'utf8');
        
        console.log(`=========================================================`);
        console.log(`✅ Processing Complete: ${data.length} questions assessed from ${INPUT_FILE}.`);
        console.log(`🔄 Successfully updated ${updateCount} questions to type 'multiple-choice'.`);
        console.log(`💾 Results saved to the new, clean file: '${OUTPUT_FILE}'`);
        console.log(`=========================================================`);
        
    } catch (error) {
        console.error(`❌ Error writing to output file: ${error.message}`);
    }
}

// --- Execution ---
updateQuestionTypesByOptions();