package storage_service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	s3bucket_repo "github.com/unbindapp/unbind-api/internal/repositories/s3bucket"
	"github.com/unbindapp/unbind-api/internal/services"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// fakeS3 answers object requests like an S3 server and records what the probe touched.
type fakeS3 struct {
	server   *httptest.Server
	mu       sync.Mutex
	requests []string
	denyPut  bool
}

func newFakeS3() *fakeS3 {
	f := &fakeS3{}
	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.requests = append(f.requests, r.Method+" "+r.URL.Path)
		f.mu.Unlock()

		if r.Method == http.MethodPut && f.denyPut {
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>`))
			return
		}
		if r.Method == http.MethodDelete {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	return f
}

func (f *fakeS3) probesOf(bucket string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	count := 0
	for _, r := range f.requests {
		if strings.HasPrefix(r, "PUT /"+bucket+"/.probe-") {
			count++
		}
	}
	return count
}

func (f *fakeS3) requestCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.requests)
}

type S3BucketSuite struct {
	services.ServiceTestSuite
	service *StorageService
	fake    *fakeS3

	testUserID   uuid.UUID
	testTeamID   uuid.UUID
	testBucketID uuid.UUID
	testTeam     *ent.Team
	testSecret   *corev1.Secret
	testBucket   *ent.S3Bucket
	k8sClient    *kubernetes.Clientset
}

func (suite *S3BucketSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()

	suite.service = &StorageService{
		repo: suite.MockRepo,
		k8s:  suite.MockK8s,
	}
	suite.fake = newFakeS3()

	suite.testUserID = uuid.New()
	suite.testTeamID = uuid.New()
	suite.testBucketID = uuid.New()
	suite.testTeam = &ent.Team{
		ID:        suite.testTeamID,
		Namespace: "unbind-team",
	}
	suite.testSecret = &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "s3-backups-abc123"},
		Data: map[string][]byte{
			"access_key_id": []byte("AKIA"),
			"secret_key":    []byte("secret"),
		},
	}
	suite.testBucket = &ent.S3Bucket{
		ID:               suite.testBucketID,
		TeamID:           suite.testTeamID,
		Name:             "Backups",
		Endpoint:         suite.fake.server.URL,
		Region:           "us-east-1",
		Bucket:           "old-bucket",
		KubernetesSecret: suite.testSecret.Name,
	}
	suite.k8sClient = &kubernetes.Clientset{}
}

func (suite *S3BucketSuite) TearDownTest() {
	suite.fake.server.Close()
	suite.ServiceTestSuite.TearDownTest()
}

func (suite *S3BucketSuite) expectPermissionAndTeam() {
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.Anything).
		Return(nil).
		Once()

	suite.MockTeamRepo.EXPECT().
		GetByID(suite.Ctx, suite.testTeamID).
		Return(suite.testTeam, nil).
		Once()
}

func (suite *S3BucketSuite) expectExistingBucketWithSecret() {
	suite.MockS3BucketRepo.EXPECT().
		GetByID(suite.Ctx, suite.testBucketID).
		Return(suite.testBucket, nil).
		Once()

	suite.MockK8s.EXPECT().
		GetInternalClient().
		Return(suite.k8sClient)

	suite.MockK8s.EXPECT().
		GetSecret(suite.Ctx, suite.testSecret.Name, suite.testTeam.Namespace, suite.k8sClient).
		Return(suite.testSecret, nil).
		Once()
}

func (suite *S3BucketSuite) TestCreateProbesGivenBucket() {
	suite.expectPermissionAndTeam()

	suite.MockK8s.EXPECT().
		GetInternalClient().
		Return(suite.k8sClient)

	suite.MockRepo.EXPECT().
		WithTx(suite.Ctx, mock.AnythingOfType("func(repository.TxInterface) error")).
		RunAndReturn(func(ctx context.Context, fn func(repository.TxInterface) error) error {
			return fn(suite.NewTxMockTyped())
		}).
		Once()

	createdSecret := &corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: "s3-backups-xyz789"}}
	suite.MockK8s.EXPECT().
		GetOrCreateSecret(suite.Ctx, mock.AnythingOfType("string"), suite.testTeam.Namespace, suite.k8sClient).
		Return(createdSecret, true, nil).
		Once()

	suite.MockK8s.EXPECT().
		OverwriteSecretValues(suite.Ctx, createdSecret.Name, suite.testTeam.Namespace, mock.MatchedBy(func(values map[string][]byte) bool {
			return string(values["access_key_id"]) == "AKIA" &&
				string(values["secret_key"]) == "secret" &&
				strings.Contains(string(values["config"]), "region = us-east-1")
		}), suite.k8sClient).
		Return(createdSecret, nil).
		Once()

	suite.MockS3BucketRepo.EXPECT().
		Create(suite.Ctx, mock.Anything, mock.MatchedBy(func(input *s3bucket_repo.CreateS3BucketInput) bool {
			return input.TeamID == suite.testTeamID &&
				input.Bucket == "my-bucket" &&
				input.KubernetesSecret == createdSecret.Name
		})).
		Return(&ent.S3Bucket{ID: uuid.New(), TeamID: suite.testTeamID, Name: "Backups", Bucket: "my-bucket"}, nil).
		Once()

	result, err := suite.service.CreateS3Bucket(suite.Ctx, suite.testUserID, &models.S3BucketCreateInput{
		TeamID:      suite.testTeamID,
		Name:        "Backups",
		Endpoint:    suite.fake.server.URL,
		Region:      "us-east-1",
		Bucket:      "my-bucket",
		AccessKeyID: "AKIA",
		SecretKey:   "secret",
	})

	suite.NoError(err)
	suite.Equal("my-bucket", result.Bucket)
	suite.Equal("AKIA", result.AccessKey)
	suite.Equal(1, suite.fake.probesOf("my-bucket"))
}

func (suite *S3BucketSuite) TestCreateRejectsBucketWithoutWriteAccess() {
	suite.fake.denyPut = true
	suite.expectPermissionAndTeam()

	result, err := suite.service.CreateS3Bucket(suite.Ctx, suite.testUserID, &models.S3BucketCreateInput{
		TeamID:      suite.testTeamID,
		Name:        "Backups",
		Endpoint:    suite.fake.server.URL,
		Region:      "us-east-1",
		Bucket:      "locked-bucket",
		AccessKeyID: "AKIA",
		SecretKey:   "secret",
	})

	suite.Error(err)
	suite.Nil(result)
	customErr := err.(*errdefs.CustomError)
	suite.Equal(errdefs.ErrTypeInvalidInput, customErr.Type)
	suite.Contains(customErr.Message, "not allowed to read and write this bucket")
	suite.Equal(1, suite.fake.probesOf("locked-bucket"))
}

func (suite *S3BucketSuite) TestUpdateRejectsEmptyInput() {
	result, err := suite.service.UpdateS3Bucket(suite.Ctx, suite.testUserID, &models.S3BucketUpdateInput{
		ID:     suite.testBucketID,
		TeamID: suite.testTeamID,
	})

	suite.Error(err)
	suite.Nil(result)
	customErr := err.(*errdefs.CustomError)
	suite.Equal(errdefs.ErrTypeInvalidInput, customErr.Type)
}

func (suite *S3BucketSuite) TestUpdateNameOnlySkipsProbe() {
	suite.expectPermissionAndTeam()
	suite.expectExistingBucketWithSecret()

	newName := "Renamed"
	renamed := *suite.testBucket
	renamed.Name = newName

	suite.MockS3BucketRepo.EXPECT().
		Update(suite.Ctx, suite.testBucketID, &s3bucket_repo.UpdateS3BucketInput{Name: &newName}).
		Return(&renamed, nil).
		Once()

	result, err := suite.service.UpdateS3Bucket(suite.Ctx, suite.testUserID, &models.S3BucketUpdateInput{
		ID:     suite.testBucketID,
		TeamID: suite.testTeamID,
		Name:   &newName,
	})

	suite.NoError(err)
	suite.Equal(newName, result.Name)
	suite.Equal("AKIA", result.AccessKey)
	suite.Equal(0, suite.fake.requestCount())
}

func (suite *S3BucketSuite) TestUpdateBucketChangeProbesAndRewritesSecret() {
	suite.expectPermissionAndTeam()
	suite.expectExistingBucketWithSecret()

	newBucket := "new-bucket"
	updated := *suite.testBucket
	updated.Bucket = newBucket

	suite.MockK8s.EXPECT().
		OverwriteSecretValues(suite.Ctx, suite.testSecret.Name, suite.testTeam.Namespace, mock.MatchedBy(func(values map[string][]byte) bool {
			return string(values["access_key_id"]) == "AKIA" && string(values["secret_key"]) == "secret"
		}), suite.k8sClient).
		Return(suite.testSecret, nil).
		Once()

	suite.MockS3BucketRepo.EXPECT().
		Update(suite.Ctx, suite.testBucketID, &s3bucket_repo.UpdateS3BucketInput{Bucket: &newBucket}).
		Return(&updated, nil).
		Once()

	result, err := suite.service.UpdateS3Bucket(suite.Ctx, suite.testUserID, &models.S3BucketUpdateInput{
		ID:     suite.testBucketID,
		TeamID: suite.testTeamID,
		Bucket: &newBucket,
	})

	suite.NoError(err)
	suite.Equal(newBucket, result.Bucket)
	suite.Equal(1, suite.fake.probesOf(newBucket))
	suite.Equal(0, suite.fake.probesOf("old-bucket"))
}

func (suite *S3BucketSuite) TestUpdateRejectsBucketOfAnotherTeam() {
	suite.expectPermissionAndTeam()

	foreign := *suite.testBucket
	foreign.TeamID = uuid.New()
	suite.MockS3BucketRepo.EXPECT().
		GetByID(suite.Ctx, suite.testBucketID).
		Return(&foreign, nil).
		Once()

	newName := "Renamed"
	result, err := suite.service.UpdateS3Bucket(suite.Ctx, suite.testUserID, &models.S3BucketUpdateInput{
		ID:     suite.testBucketID,
		TeamID: suite.testTeamID,
		Name:   &newName,
	})

	suite.Error(err)
	suite.Nil(result)
	customErr := err.(*errdefs.CustomError)
	suite.Equal(errdefs.ErrTypeNotFound, customErr.Type)
}

func TestS3BucketSuite(t *testing.T) {
	suite.Run(t, new(S3BucketSuite))
}
