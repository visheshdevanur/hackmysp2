-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "image" TEXT,
    "githubId" TEXT,
    "githubUsername" TEXT,
    "role" TEXT NOT NULL DEFAULT 'student',
    "priScore" INTEGER NOT NULL DEFAULT 0,
    "codePrint" TEXT,
    "expertise" TEXT NOT NULL DEFAULT '[]',
    "companyName" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "requirements" TEXT NOT NULL DEFAULT '[]',
    "jobDetailsJson" TEXT NOT NULL DEFAULT '{}',
    "priQuestionConfigJson" TEXT NOT NULL DEFAULT '{}',
    "creatorId" TEXT NOT NULL,
    "companyName" TEXT,
    "deadline" TIMESTAMP(3),
    "sessionDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "githubRepoUrl" TEXT NOT NULL,
    "submissionMode" TEXT NOT NULL DEFAULT 'repository',
    "repoCommitSha" TEXT,
    "aiModel" TEXT,
    "quizJson" TEXT,
    "quizScore" INTEGER,
    "quizAnswers" TEXT,
    "quizSubmittedAt" TIMESTAMP(3),
    "quizAttemptStatus" TEXT NOT NULL DEFAULT 'ready',
    "quizAttemptStartedAt" TIMESTAMP(3),
    "quizAttemptFinishedAt" TIMESTAMP(3),
    "quizAttemptDataJson" TEXT,
    "speakingStatus" TEXT NOT NULL DEFAULT 'ready',
    "speakingStartedAt" TIMESTAMP(3),
    "speakingFinishedAt" TIMESTAMP(3),
    "speakingDataJson" TEXT,
    "speakingResultJson" TEXT,
    "commits" INTEGER NOT NULL DEFAULT 0,
    "daysTaken" INTEGER NOT NULL DEFAULT 0,
    "codeQuality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "peerReviewAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeliness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "learningVelocity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "skillMatch" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priScore" INTEGER NOT NULL DEFAULT 0,
    "reviewerScore" INTEGER NOT NULL DEFAULT 0,
    "verificationCode" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "correctness" INTEGER NOT NULL,
    "codeStructure" INTEGER NOT NULL,
    "documentation" INTEGER NOT NULL,
    "edgeCaseHandling" INTEGER NOT NULL,
    "innovation" INTEGER NOT NULL,
    "comment" TEXT,
    "calculatedScore" INTEGER NOT NULL,
    "credibilityWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "credentialId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "durationSeconds" INTEGER NOT NULL,
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "segmentCount" INTEGER NOT NULL DEFAULT 0,
    "lastHeartbeatAt" TIMESTAMP(3),
    "repoUrl" TEXT,
    "repoCommitSha" TEXT,
    "analysisJson" TEXT,
    "analysisModel" TEXT,
    "analysisError" TEXT,
    "privacyAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WorkSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSessionRecording" (
    "id" TEXT NOT NULL,
    "workSessionId" TEXT NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkSessionRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriQuizRecording" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriQuizRecording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "User_githubUsername_key" ON "User"("githubUsername");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_verificationCode_key" ON "Credential"("verificationCode");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_userId_challengeId_repoCommitSha_submissionMode_key" ON "Credential"("userId", "challengeId", "repoCommitSha", "submissionMode");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_credentialId_key" ON "Review"("userId", "credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSession_credentialId_key" ON "WorkSession"("credentialId");

-- CreateIndex
CREATE INDEX "WorkSession_userId_status_idx" ON "WorkSession"("userId", "status");

-- CreateIndex
CREATE INDEX "WorkSession_challengeId_status_idx" ON "WorkSession"("challengeId", "status");

-- CreateIndex
CREATE INDEX "WorkSessionRecording_workSessionId_segmentIndex_idx" ON "WorkSessionRecording"("workSessionId", "segmentIndex");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSessionRecording_workSessionId_segmentIndex_chunkIndex_key" ON "WorkSessionRecording"("workSessionId", "segmentIndex", "chunkIndex");

-- CreateIndex
CREATE INDEX "PriQuizRecording_credentialId_segmentIndex_idx" ON "PriQuizRecording"("credentialId", "segmentIndex");

-- CreateIndex
CREATE UNIQUE INDEX "PriQuizRecording_credentialId_segmentIndex_chunkIndex_key" ON "PriQuizRecording"("credentialId", "segmentIndex", "chunkIndex");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSessionRecording" ADD CONSTRAINT "WorkSessionRecording_workSessionId_fkey" FOREIGN KEY ("workSessionId") REFERENCES "WorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriQuizRecording" ADD CONSTRAINT "PriQuizRecording_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

