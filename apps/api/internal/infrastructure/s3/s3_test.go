package s3

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
	smithyhttp "github.com/aws/smithy-go/transport/http"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

// MockS3API is a mock implementation of the S3 API
type MockS3API struct {
	mock.Mock
}

func (m *MockS3API) PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*s3.PutObjectOutput), args.Error(1)
}

func (m *MockS3API) HeadObject(ctx context.Context, params *s3.HeadObjectInput, optFns ...func(*s3.Options)) (*s3.HeadObjectOutput, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*s3.HeadObjectOutput), args.Error(1)
}

func (m *MockS3API) DeleteObject(ctx context.Context, params *s3.DeleteObjectInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*s3.DeleteObjectOutput), args.Error(1)
}

// S3TestSuite defines the test suite for S3 client
type S3TestSuite struct {
	suite.Suite
	ctx       context.Context
	cancel    context.CancelFunc
	mockS3API *MockS3API
	s3Client  *S3Client
}

func (suite *S3TestSuite) SetupSuite() {
	suite.ctx, suite.cancel = context.WithTimeout(context.Background(), 30*time.Second)
}

func (suite *S3TestSuite) TearDownSuite() {
	if suite.cancel != nil {
		suite.cancel()
	}
}

func (suite *S3TestSuite) SetupTest() {
	suite.mockS3API = &MockS3API{}
	suite.s3Client = NewS3ClientWithAPI(suite.mockS3API)

	// Reset mock expectations
	suite.mockS3API.ExpectedCalls = nil
}

// Test NewS3Client function
func (suite *S3TestSuite) TestNewS3Client_ValidEndpoint() {
	ctx := context.Background()
	endpoint := "https://s3.amazonaws.com"
	region := "us-east-1"
	accessKey := "test-access-key"
	secretKey := "test-secret-key"

	client, err := NewS3Client(ctx, endpoint, region, accessKey, secretKey)

	suite.NoError(err)
	suite.NotNil(client)
	suite.NotNil(client.client)
}

func (suite *S3TestSuite) TestNewS3Client_EndpointValidation() {
	tests := []struct {
		endpoint string
		valid    bool
	}{
		{"https://s3.amazonaws.com", true},
		{"https://abc.r2.cloudflarestorage.com", true},
		{"http://minio:9000", true},
		{"donjon", false},
		{"abc.r2.cloudflarestorage.com", false},
		{"ftp://s3.amazonaws.com", false},
		{"https://", false},
		{"", false},
	}

	for _, tt := range tests {
		client, err := NewS3Client(context.Background(), tt.endpoint, "auto", "key", "secret")
		if tt.valid {
			suite.NoError(err, tt.endpoint)
			suite.NotNil(client, tt.endpoint)
			continue
		}
		var customErr *errdefs.CustomError
		suite.ErrorAs(err, &customErr, tt.endpoint)
		suite.Equal(errdefs.ErrTypeInvalidInput, customErr.Type, tt.endpoint)
	}
}

// Test NewS3ClientWithAPI function
func (suite *S3TestSuite) TestNewS3ClientWithAPI() {
	mockAPI := &MockS3API{}
	client := NewS3ClientWithAPI(mockAPI)

	suite.NotNil(client)
	suite.Equal(mockAPI, client.client)
}

// Test ProbeBucketRW method
func (suite *S3TestSuite) TestProbeBucketRW_Success() {
	bucketName := "test-bucket"
	putOutput := &s3.PutObjectOutput{}
	headOutput := &s3.HeadObjectOutput{}
	deleteOutput := &s3.DeleteObjectOutput{}

	suite.mockS3API.On("PutObject", suite.ctx, mock.AnythingOfType("*s3.PutObjectInput")).Return(putOutput, nil)
	suite.mockS3API.On("HeadObject", suite.ctx, mock.AnythingOfType("*s3.HeadObjectInput")).Return(headOutput, nil)
	suite.mockS3API.On("DeleteObject", suite.ctx, mock.AnythingOfType("*s3.DeleteObjectInput")).Return(deleteOutput, nil)

	// Execute test
	err := suite.s3Client.ProbeBucketRW(suite.ctx, bucketName)

	// Assertions
	suite.NoError(err)
	suite.mockS3API.AssertExpectations(suite.T())
}

func (suite *S3TestSuite) TestProbeBucketRW_PutObjectError() {
	bucketName := "test-bucket"
	httpErr := &smithyhttp.ResponseError{
		Response: &smithyhttp.Response{
			Response: &http.Response{StatusCode: 403},
		},
		Err: errors.New("forbidden"),
	}

	suite.mockS3API.On("PutObject", suite.ctx, mock.AnythingOfType("*s3.PutObjectInput")).Return(nil, httpErr)

	// Execute test
	err := suite.s3Client.ProbeBucketRW(suite.ctx, bucketName)

	// Assertions
	suite.Error(err)
	customErr := err.(*errdefs.CustomError)
	suite.Equal(errdefs.ErrTypeInvalidInput, customErr.Type)
	suite.mockS3API.AssertExpectations(suite.T())
}

func (suite *S3TestSuite) TestProbeBucketRW_HeadObjectError() {
	bucketName := "test-bucket"
	putOutput := &s3.PutObjectOutput{}
	deleteOutput := &s3.DeleteObjectOutput{}
	httpErr := &smithyhttp.ResponseError{
		Response: &smithyhttp.Response{
			Response: &http.Response{StatusCode: 404},
		},
		Err: errors.New("not found"),
	}

	suite.mockS3API.On("PutObject", suite.ctx, mock.AnythingOfType("*s3.PutObjectInput")).Return(putOutput, nil)
	suite.mockS3API.On("HeadObject", suite.ctx, mock.AnythingOfType("*s3.HeadObjectInput")).Return(nil, httpErr)
	suite.mockS3API.On("DeleteObject", suite.ctx, mock.AnythingOfType("*s3.DeleteObjectInput")).Return(deleteOutput, nil)

	// Execute test
	err := suite.s3Client.ProbeBucketRW(suite.ctx, bucketName)

	// Assertions
	suite.Error(err)
	customErr := err.(*errdefs.CustomError)
	suite.Equal(errdefs.ErrTypeNotFound, customErr.Type)
	suite.mockS3API.AssertExpectations(suite.T())
}

func (suite *S3TestSuite) TestProbeBucketRW_PutObjectAccessDenied() {
	httpErr := &smithyhttp.ResponseError{
		Response: &smithyhttp.Response{
			Response: &http.Response{StatusCode: 403},
		},
		Err: &smithy.GenericAPIError{Code: "AccessDenied", Message: "Access Denied"},
	}

	suite.mockS3API.On("PutObject", suite.ctx, mock.AnythingOfType("*s3.PutObjectInput")).Return(nil, httpErr)

	err := suite.s3Client.ProbeBucketRW(suite.ctx, "test-bucket")

	suite.Error(err)
	customErr := err.(*errdefs.CustomError)
	suite.Equal(errdefs.ErrTypeInvalidInput, customErr.Type)
	suite.Contains(customErr.Message, "not allowed to read and write this bucket")
	suite.mockS3API.AssertExpectations(suite.T())
}

// Test mapS3Error function
func (suite *S3TestSuite) TestMapS3Error_InvalidAccessKey() {
	for _, code := range []string{"InvalidAccessKeyId", "SignatureDoesNotMatch", "Unauthorized"} {
		httpErr := &smithyhttp.ResponseError{
			Response: &smithyhttp.Response{
				Response: &http.Response{StatusCode: 403},
			},
			Err: &smithy.GenericAPIError{Code: code, Message: "bad key"},
		}

		result := mapS3Error(httpErr)

		customErr := result.(*errdefs.CustomError)
		suite.Equal(errdefs.ErrTypeInvalidInput, customErr.Type)
		suite.Contains(customErr.Message, "Invalid access key ID or secret access key")
	}
}

func (suite *S3TestSuite) TestMapS3Error_NoSuchBucket() {
	httpErr := &smithyhttp.ResponseError{
		Response: &smithyhttp.Response{
			Response: &http.Response{StatusCode: 404},
		},
		Err: &smithy.GenericAPIError{Code: "NoSuchBucket", Message: "missing"},
	}

	result := mapS3Error(httpErr)

	customErr := result.(*errdefs.CustomError)
	suite.Equal(errdefs.ErrTypeNotFound, customErr.Type)
	suite.Contains(customErr.Message, "Bucket not found")
}

func (suite *S3TestSuite) TestMapS3Error_401Unauthorized() {
	httpErr := &smithyhttp.ResponseError{
		Response: &smithyhttp.Response{
			Response: &http.Response{StatusCode: 401},
		},
		Err: errors.New("unauthorized"),
	}

	result := mapS3Error(httpErr)

	customErr := result.(*errdefs.CustomError)
	suite.Equal(errdefs.ErrTypeInvalidInput, customErr.Type)
	suite.Contains(customErr.Message, "Invalid access key ID or secret access key")
}

func (suite *S3TestSuite) TestMapS3Error_403Forbidden() {
	httpErr := &smithyhttp.ResponseError{
		Response: &smithyhttp.Response{
			Response: &http.Response{StatusCode: 403},
		},
		Err: errors.New("forbidden"),
	}

	result := mapS3Error(httpErr)

	customErr := result.(*errdefs.CustomError)
	suite.Equal(errdefs.ErrTypeInvalidInput, customErr.Type)
	suite.Contains(customErr.Message, "Invalid endpoint URL or access forbidden")
}

func (suite *S3TestSuite) TestMapS3Error_404NotFound() {
	httpErr := &smithyhttp.ResponseError{
		Response: &smithyhttp.Response{
			Response: &http.Response{StatusCode: 404},
		},
		Err: errors.New("not found"),
	}

	result := mapS3Error(httpErr)

	customErr := result.(*errdefs.CustomError)
	suite.Equal(errdefs.ErrTypeNotFound, customErr.Type)
	suite.Contains(customErr.Message, "Bucket or object not found")
}

func (suite *S3TestSuite) TestMapS3Error_301Redirect() {
	httpErr := &smithyhttp.ResponseError{
		Response: &smithyhttp.Response{
			Response: &http.Response{StatusCode: 301},
		},
		Err: errors.New("moved permanently"),
	}

	result := mapS3Error(httpErr)

	customErr := result.(*errdefs.CustomError)
	suite.Equal(errdefs.ErrTypeInvalidInput, customErr.Type)
	suite.Contains(customErr.Message, "Wrong region for bucket")
}

func (suite *S3TestSuite) TestMapS3Error_URLError() {
	urlErr := &url.Error{
		Op:  "Put",
		URL: "https://abc.r2.cloudflarestorage.com/bucket/.probe-123?x-id=PutObject",
		Err: errors.New("remote error: tls: handshake failure"),
	}

	result := mapS3Error(urlErr)

	customErr := result.(*errdefs.CustomError)
	suite.Equal(errdefs.ErrTypeInvalidInput, customErr.Type)
	suite.Equal("Could not connect to the endpoint: remote error: tls: handshake failure", customErr.Message)
}

func (suite *S3TestSuite) TestMapS3Error_OtherError() {
	genericErr := errors.New("some other error")

	result := mapS3Error(genericErr)

	suite.Equal(genericErr, result)
}

// Test NewHttpClient function
func (suite *S3TestSuite) TestNewHttpClient() {
	client := NewHttpClient()

	suite.NotNil(client)
	// We can't test much more about the HTTP client without exposing internal properties
	// But we can ensure it doesn't panic and returns something
}

// Test interface implementation
func (suite *S3TestSuite) TestMockImplementsInterface() {
	var _ S3APIInterface = suite.mockS3API
}

func TestS3TestSuite(t *testing.T) {
	suite.Run(t, new(S3TestSuite))
}
