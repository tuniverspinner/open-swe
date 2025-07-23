try {
  const { extractImageUrls } = require('./packages/shared/dist/github-images.js');
  console.log('✅ Successfully imported extractImageUrls function');
  
  // Test with sample markdown content containing both markdown and HTML image formats
  const testContent = `
Here is a markdown image: ![test image](https://github.com/user/repo/image.png)
And here is an HTML image: <img src="https://user-images.githubusercontent.com/123/test.jpg" alt="test image">
This should be ignored (not HTTPS): ![bad](http://example.com/image.png)
This should be ignored (untrusted domain): ![bad](https://example.com/image.png)
`;
  
  const result = extractImageUrls(testContent);
  console.log('✅ Function executed successfully');
  console.log('Extracted images:', JSON.stringify(result, null, 2));
  
  if (result.length === 2) {
    console.log('✅ Image extraction working correctly - found expected 2 valid images');
  } else {
    console.log(`❌ Expected 2 images, but found ${result.length}`);
  }
} catch (error) {
  console.error('❌ Import or execution failed:', error.message);
  process.exit(1);
}

