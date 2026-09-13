package com.readora.web.arch;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

@AnalyzeClasses(packages = "com.readora", importOptions = {ImportOption.DoNotIncludeTests.class})
public class HexagonalArchitectureArchTest {

    @ArchTest
    public static final ArchRule domain_should_have_zero_spring_dependencies =
            noClasses().that().resideInAPackage("..domain..")
                    .should().dependOnClassesThat().resideInAnyPackage(
                            "org.springframework..",
                            "jakarta.persistence..",
                            "jakarta.servlet..",
                            "com.readora.application..",
                            "com.readora.infrastructure..",
                            "com.readora.web.."
                    );

    @ArchTest
    public static final ArchRule application_should_only_depend_on_domain =
            classes().that().resideInAPackage("..application..")
                    .should().onlyDependOnClassesThat().resideInAnyPackage(
                            "com.readora.domain..",
                            "com.readora.application..",
                            "java..",
                            "org.slf4j.."
                    );

    @ArchTest
    public static final ArchRule infrastructure_should_not_depend_on_web =
            noClasses().that().resideInAPackage("..infrastructure..")
                    .should().dependOnClassesThat().resideInAPackage("..web..");
}
