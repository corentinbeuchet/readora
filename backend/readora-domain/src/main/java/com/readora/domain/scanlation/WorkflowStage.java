package com.readora.domain.scanlation;

public enum WorkflowStage {
    RAW_UPLOADED,
    CLEANING,
    TRANSLATING,
    TYPESETTING,
    PROOFREADING,
    QC_REVIEW,
    PUBLISHED;

    public WorkflowStage nextStage() {
        return switch (this) {
            case RAW_UPLOADED -> CLEANING;
            case CLEANING -> TRANSLATING;
            case TRANSLATING -> TYPESETTING;
            case TYPESETTING -> PROOFREADING;
            case PROOFREADING -> QC_REVIEW;
            case QC_REVIEW -> PUBLISHED;
            case PUBLISHED -> PUBLISHED;
        };
    }

    public ScanlationRole requiredRole() {
        return switch (this) {
            case RAW_UPLOADED, CLEANING -> ScanlationRole.CLEANER_REDRAWER;
            case TRANSLATING -> ScanlationRole.TRANSLATOR;
            case TYPESETTING -> ScanlationRole.TYPESETTER;
            case PROOFREADING -> ScanlationRole.PROOFREADER;
            case QC_REVIEW, PUBLISHED -> ScanlationRole.QUALITY_CHECKER;
        };
    }
}
