package utils

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type FileUtilsTestSuite struct {
	suite.Suite
	tempDir string
}

// SetupTest runs before each test
func (suite *FileUtilsTestSuite) SetupTest() {
	// Create a temporary directory for test files
	tempDir, err := os.MkdirTemp("", "fileutils-test-")
	require.NoError(suite.T(), err)
	suite.tempDir = tempDir
}

// TearDownTest runs after each test
func (suite *FileUtilsTestSuite) TearDownTest() {
	// Remove the temporary directory and its contents
	os.RemoveAll(suite.tempDir)
}

// createTestFile creates a file with given name and content in the temp directory
func (suite *FileUtilsTestSuite) createTestFile(name, content string) string {
	path := filepath.Join(suite.tempDir, name)
	// Ensure parent directory exists
	dir := filepath.Dir(path)
	if dir != suite.tempDir {
		err := os.MkdirAll(dir, 0755)
		require.NoError(suite.T(), err)
	}
	err := os.WriteFile(path, []byte(content), 0644)
	require.NoError(suite.T(), err)
	return path
}

// createTestDirectory creates a directory with the given name in the temp directory
func (suite *FileUtilsTestSuite) createTestDirectory(name string) string {
	path := filepath.Join(suite.tempDir, name)
	err := os.MkdirAll(path, 0755)
	require.NoError(suite.T(), err)
	return path
}

// createBinaryFile creates a file with some binary (non-text) content
func (suite *FileUtilsTestSuite) createBinaryFile(name string) string {
	path := filepath.Join(suite.tempDir, name)
	// Create some binary data with null bytes
	data := []byte{0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x77, 0x6f, 0x72, 0x6c, 0x64}
	err := os.WriteFile(path, data, 0644)
	require.NoError(suite.T(), err)
	return path
}

// TestFindFiles tests the FindFiles function
func (suite *FileUtilsTestSuite) TestFindFiles() {
	// Create test files
	suite.createTestFile("test1.txt", "content1")
	suite.createTestFile("test2.txt", "content2")
	suite.createTestFile("test.go", "package main")
	suite.createDirectory("subdir")
	suite.createTestFile("subdir/test3.txt", "content3")
	suite.createTestFile("subdir/test2.go", "package subpkg")

	// Test finding all txt files
	files, err := FindFiles(suite.tempDir, "*.txt")
	suite.NoError(err)
	suite.Equal(3, len(files))
	suite.True(containsPath(files, "test1.txt"))
	suite.True(containsPath(files, "test2.txt"))
	suite.True(containsPath(files, filepath.Join("subdir", "test3.txt")))

	// Test finding all go files
	files, err = FindFiles(suite.tempDir, "*.go")
	suite.NoError(err)
	suite.Equal(2, len(files))
	suite.True(containsPath(files, "test.go"))
	suite.True(containsPath(files, filepath.Join("subdir", "test2.go")))

	// Test finding with specific name
	files, err = FindFiles(suite.tempDir, "test1.txt")
	suite.NoError(err)
	suite.Equal(1, len(files))
	suite.True(containsPath(files, "test1.txt"))

	// Test with non-existent pattern
	files, err = FindFiles(suite.tempDir, "*.nonexistent")
	suite.NoError(err)
	suite.Equal(0, len(files))
}

// TestFindFilesWithExclusions tests the FindFilesWithExclusions function
func (suite *FileUtilsTestSuite) TestFindFilesWithExclusions() {
	// Create test files
	suite.createTestFile("test1.txt", "content1")
	suite.createTestFile("test2.txt", "content2")
	suite.createDirectory("subdir1")
	suite.createDirectory("subdir2")
	suite.createDirectory("node_modules")

	suite.createTestFile("subdir1/test3.txt", "content3")
	suite.createTestFile("subdir2/test4.txt", "content4")
	suite.createTestFile("node_modules/test5.txt", "should be excluded")

	// Test with exclusion
	files, err := FindFilesWithExclusions(suite.tempDir, "*.txt", []string{"node_modules"})
	suite.NoError(err)
	suite.Equal(4, len(files))
	suite.True(containsPath(files, "test1.txt"))
	suite.True(containsPath(files, "test2.txt"))
	suite.True(containsPath(files, filepath.Join("subdir1", "test3.txt")))
	suite.True(containsPath(files, filepath.Join("subdir2", "test4.txt")))
	suite.False(containsPath(files, filepath.Join("node_modules", "test5.txt")))

	// Test with multiple exclusions
	files, err = FindFilesWithExclusions(suite.tempDir, "*.txt", []string{"node_modules", "subdir1"})
	suite.NoError(err)
	suite.Equal(3, len(files))
	suite.True(containsPath(files, "test1.txt"))
	suite.True(containsPath(files, "test2.txt"))
	suite.False(containsPath(files, filepath.Join("subdir1", "test3.txt")))
	suite.True(containsPath(files, filepath.Join("subdir2", "test4.txt")))
}

// TestContainsAny tests the containsAny function
func (suite *FileUtilsTestSuite) TestContainsAny() {
	// Since containsAny is not exported, we'll test it indirectly through FindFilesWithExclusions
	suite.createTestFile("test1.txt", "content1")
	suite.createDirectory("node_modules")
	suite.createTestFile("node_modules/test2.txt", "should be excluded")

	files, err := FindFilesWithExclusions(suite.tempDir, "*.txt", []string{"node_modules"})
	suite.NoError(err)
	suite.Equal(1, len(files))
	suite.True(containsPath(files, "test1.txt"))
	suite.False(containsPath(files, filepath.Join("node_modules", "test2.txt")))
}

// TestReadFile tests the ReadFile function
func (suite *FileUtilsTestSuite) TestReadFile() {
	// Test normal file read
	expectedContent := "This is test content."
	filePath := suite.createTestFile("readfile.txt", expectedContent)

	content, err := ReadFile(filePath)
	suite.NoError(err)
	suite.Equal(expectedContent, content)

	// Test non-existent file
	_, err = ReadFile(filepath.Join(suite.tempDir, "nonexistent.txt"))
	suite.Error(err)

	// Test large file (creating a file close to the limit would be impractical for unit testing)
	// Instead, we'll test ReadFileWithLimit with a smaller limit
}

// TestReadFileWithLimit tests the ReadFileWithLimit function
func (suite *FileUtilsTestSuite) TestReadFileWithLimit() {
	// Create a file with some content
	content := strings.Repeat("Large content", 100) // ~1.2KB
	filePath := suite.createTestFile("large.txt", content)

	// Test reading within limit
	result, err := ReadFileWithLimit(filePath, 2000)
	suite.NoError(err)
	suite.Equal(content, result)

	// Test exceeding limit
	_, err = ReadFileWithLimit(filePath, 500)
	suite.Error(err)
	suite.Contains(err.Error(), "too large")
}

// TestSafeReadFile tests the SafeReadFile function
func (suite *FileUtilsTestSuite) TestSafeReadFile() {
	// Test existing file
	expectedContent := "Safe read test"
	filePath := suite.createTestFile("safe.txt", expectedContent)

	content, success := SafeReadFile(filePath)
	suite.True(success)
	suite.Equal(expectedContent, content)

	// Test non-existent file
	content, success = SafeReadFile(filepath.Join(suite.tempDir, "nonexistent.txt"))
	suite.False(success)
	suite.Empty(content)
}

// TestIsTextFile tests the IsTextFile function
func (suite *FileUtilsTestSuite) TestIsTextFile() {
	// Test text file
	textPath := suite.createTestFile("text.txt", "This is plain text.")
	suite.True(IsTextFile(textPath))

	// Test binary file
	binaryPath := suite.createBinaryFile("binary.dat")
	suite.False(IsTextFile(binaryPath))

	// Test non-existent file
	suite.False(IsTextFile(filepath.Join(suite.tempDir, "nonexistent.txt")))
}

// TestFileExists tests the FileExists function
func (suite *FileUtilsTestSuite) TestFileExists() {
	// Test existing file
	filePath := suite.createTestFile("exists.txt", "I exist")
	suite.True(FileExists(filePath))

	// Test existing directory
	dirPath := suite.createDirectory("existsdir")
	suite.True(FileExists(dirPath))

	// Test non-existent file
	suite.False(FileExists(filepath.Join(suite.tempDir, "nonexistent.txt")))
}

// Helper function to check if a path is in a slice of paths
func containsPath(paths []string, target string) bool {
	for _, path := range paths {
		if strings.HasSuffix(path, target) {
			return true
		}
	}
	return false
}

// Additional tests for edge cases

// TestReadFileBoundary tests edge cases for file reading
func (suite *FileUtilsTestSuite) TestReadFileBoundary() {
	// Test empty file
	emptyPath := suite.createTestFile("empty.txt", "")
	content, err := ReadFile(emptyPath)
	suite.NoError(err)
	suite.Equal("", content)

	// Test file with special characters
	specialContent := "Special chars: 你好, мир, 👋🌍!"
	specialPath := suite.createTestFile("special.txt", specialContent)
	content, err = ReadFile(specialPath)
	suite.NoError(err)
	suite.Equal(specialContent, content)
}

// TestFindFilesEdgeCases tests edge cases for file finding
func (suite *FileUtilsTestSuite) TestFindFilesEdgeCases() {
	// Create a new empty directory for this test
	emptyDir, err := os.MkdirTemp("", "empty-dir-")
	suite.NoError(err)
	defer os.RemoveAll(emptyDir)

	// Test with empty directory
	files, err := FindFiles(emptyDir, "*.txt")
	suite.NoError(err)
	suite.Equal(0, len(files))

	// Test with invalid pattern
	_, err = FindFiles(suite.tempDir, "[")
	suite.Error(err) // Invalid pattern should return error

	// Test with non-existent directory
	_, err = FindFiles(filepath.Join(suite.tempDir, "nonexistent"), "*.txt")
	suite.Error(err)
}

// Alias to createTestDirectory for cleaner test code
func (suite *FileUtilsTestSuite) createDirectory(name string) string {
	return suite.createTestDirectory(name)
}

// Run the test suite
func TestFileUtilsSuite(t *testing.T) {
	suite.Run(t, new(FileUtilsTestSuite))
}
