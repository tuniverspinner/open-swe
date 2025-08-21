#!/usr/bin/env node

/**
 * Test script to verify write_file diff functionality
 */

import { formatDisplayLog } from "./logger.js";

// Test write_file with content that has more than 10 lines
const writeFileChunk = {
  event: "updates",
  data: {
    agent: {
      messages: [
        {
          type: "ai",
          tool_calls: [
            {
              name: "write_file",
              args: {
                file_path: "/test/example.txt",
                content: `Line 1: This is the first line
Line 2: This is the second line
Line 3: This is the third line
Line 4: This is the fourth line
Line 5: This is the fifth line
Line 6: This is the sixth line
Line 7: This is the seventh line
Line 8: This is the eighth line
Line 9: This is the ninth line
Line 10: This is the tenth line
Line 11: This is the eleventh line
Line 12: This is the twelfth line
Line 13: This is the thirteenth line
Line 14: This is the fourteenth line
Line 15: This is the fifteenth line`
              }
            }
          ]
        }
      ]
    }
  }
};

console.log("=== Testing write_file diff functionality ===\n");

console.log("1. Testing write_file with content > 10 lines:");
const formattedLogs = formatDisplayLog(writeFileChunk);
formattedLogs.forEach((log, index) => {
  console.log(`${index}: ${log}`);
});

console.log("\n2. Testing write_file with content < 10 lines:");
const shortWriteFileChunk = {
  event: "updates",
  data: {
    agent: {
      messages: [
        {
          type: "ai",
          tool_calls: [
            {
              name: "write_file",
              args: {
                file_path: "/test/short.txt",
                content: `Line 1: Short file
Line 2: Only 3 lines
Line 3: That's it!`
              }
            }
          ]
        }
      ]
    }
  }
};

const shortFormattedLogs = formatDisplayLog(shortWriteFileChunk);
shortFormattedLogs.forEach((log, index) => {
  console.log(`${index}: ${log}`);
});

console.log("\n=== Test Complete ===");
